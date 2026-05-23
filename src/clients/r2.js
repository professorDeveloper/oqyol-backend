import crypto from "node:crypto";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

let client = null;

function getClient() {
  if (client) return client;
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials are not configured");
  }
  client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function buildKey(prefix, originalName) {
  const ext = path.extname(originalName || "").toLowerCase().slice(0, 8);
  const id = crypto.randomBytes(16).toString("hex");
  const safePrefix = prefix.replace(/^\/+|\/+$/gu, "");
  return `${safePrefix}/${id}${ext}`;
}

export async function uploadBuffer({ buffer, contentType, prefix, originalName }) {
  const key = buildKey(prefix, originalName);
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  const base = env.R2_PUBLIC_URL.replace(/\/+$/u, "");
  return { key, url: `${base}/${key}` };
}

export async function deleteByUrl(url) {
  if (!url) return;
  const base = env.R2_PUBLIC_URL.replace(/\/+$/u, "");
  if (!url.startsWith(`${base}/`)) return;
  const key = url.slice(base.length + 1);
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key })
    );
  } catch {
    // best-effort cleanup; ignore failures
  }
}
