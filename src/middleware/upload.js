import multer from "multer";
import { BadRequestError } from "../shared/errors.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new BadRequestError("Only jpeg, png, or webp images are allowed", "INVALID_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});

export function singleImage(field) {
  const handler = imageUpload.single(field);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new BadRequestError("File too large (max 5MB)", "FILE_TOO_LARGE"));
        }
        return next(new BadRequestError(err.message, "UPLOAD_ERROR"));
      }
      next(err);
    });
  };
}
