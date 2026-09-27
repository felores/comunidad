import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Resend } from "resend";

export type TransactionalMessage = {
  kind: "verification" | "password-reset";
  to: string;
  url: string;
  idempotencyKey: string;
};

export interface TransactionalEmailProvider {
  send(message: TransactionalMessage): Promise<void>;
}

const subjects: Record<TransactionalMessage["kind"], string> = {
  verification: "Verifica tu cuenta de Sociedad Paralela",
  "password-reset": "Restablece tu acceso a Sociedad Paralela",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

function renderMessage(message: TransactionalMessage) {
  const action = message.kind === "verification" ? "Verificar mi cuenta" : "Restablecer mi clave";
  const url = escapeHtml(message.url);
  return {
    subject: subjects[message.kind],
    text: `${action}: ${message.url}\n\nSi no solicitaste esto, ignora este mensaje.`,
    html: `<p>${action}</p><p><a href="${url}">${action}</a></p><p>Si no solicitaste esto, ignora este mensaje.</p>`,
  };
}

export class MemoryEmailProvider implements TransactionalEmailProvider {
  readonly messages: TransactionalMessage[] = [];

  async send(message: TransactionalMessage): Promise<void> {
    this.messages.push(structuredClone(message));
  }
}

class FileEmailProvider implements TransactionalEmailProvider {
  private readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  async send(message: TransactionalMessage): Promise<void> {
    const directory = resolve(this.directory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const filename = `${Date.now()}-${message.kind}-${crypto.randomUUID()}.json`;
    await writeFile(
      resolve(directory, filename),
      JSON.stringify({ ...message, previewOnly: true }, null, 2),
      { mode: 0o600 },
    );
  }
}

class ResendEmailProvider implements TransactionalEmailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(
    apiKey: string,
    from: string,
  ) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: TransactionalMessage): Promise<void> {
    const content = renderMessage(message);
    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [message.to],
        ...content,
      },
      { idempotencyKey: message.idempotencyKey.slice(0, 256) },
    );
    if (error) throw new Error(`Transactional email rejected: ${error.message}`);
  }
}

export function createEmailProvider(): TransactionalEmailProvider {
  const transport = process.env.EMAIL_TRANSPORT ?? (process.env.NODE_ENV === "production" ? "resend" : "file");

  if (transport === "file") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EMAIL_TRANSPORT=file is forbidden in production");
    }
    return new FileEmailProvider(process.env.EMAIL_FILE_DIR ?? ".local-email");
  }

  if (transport !== "resend") throw new Error(`Unsupported EMAIL_TRANSPORT: ${transport}`);
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Resend transport requires RESEND_API_KEY and EMAIL_FROM");
  return new ResendEmailProvider(apiKey, from);
}

export function verificationMessage(to: string, url: string, token: string): TransactionalMessage {
  return { kind: "verification", to, url, idempotencyKey: `verify/${token}` };
}

export function passwordResetMessage(to: string, url: string, token: string): TransactionalMessage {
  return { kind: "password-reset", to, url, idempotencyKey: `password-reset/${token}` };
}
