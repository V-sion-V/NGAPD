import {
  argon2,
  randomBytes,
  timingSafeEqual,
  createHash,
  type Argon2Parameters,
} from "node:crypto";

type DerivedArgon2Parameters = Omit<Argon2Parameters, "message" | "nonce">;

const passwordParameters: DerivedArgon2Parameters = {
  parallelism: 1,
  tagLength: 32,
  memory: 65_536,
  passes: 3,
};

function derivePassword(message: string, nonce: Buffer, parameters: DerivedArgon2Parameters) {
  return new Promise<Buffer>((resolve, reject) => {
    argon2("argon2id", { ...parameters, message, nonce }, (error, derivedKey) => {
      if (error) {
        reject(error);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const nonce = randomBytes(16);
  const derived = await derivePassword(password, nonce, passwordParameters);
  return [
    "argon2id",
    "v=19",
    `m=${passwordParameters.memory},t=${passwordParameters.passes},p=${passwordParameters.parallelism}`,
    nonce.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, version, rawParameters, rawNonce, rawExpected] = encoded.split("$");
  if (
    algorithm !== "argon2id" ||
    version !== "v=19" ||
    !rawParameters ||
    !rawNonce ||
    !rawExpected
  ) {
    return false;
  }
  const entries = Object.fromEntries(
    rawParameters.split(",").map((entry) => {
      const [key, value] = entry.split("=");
      return [key, Number(value)];
    }),
  );
  const memory = entries.m;
  const passes = entries.t;
  const parallelism = entries.p;
  if (!Number.isInteger(memory) || !Number.isInteger(passes) || !Number.isInteger(parallelism)) {
    return false;
  }
  const parameters: DerivedArgon2Parameters = {
    memory: memory!,
    passes: passes!,
    parallelism: parallelism!,
    tagLength: 32,
  };
  try {
    const expected = Buffer.from(rawExpected, "base64url");
    const actual = await derivePassword(password, Buffer.from(rawNonce, "base64url"), parameters);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSecret(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function createPairingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function normalizeLoginName(loginName: string): string {
  return loginName.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}
