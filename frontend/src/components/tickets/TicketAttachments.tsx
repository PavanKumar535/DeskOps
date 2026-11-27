
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Attachment } from "../../api";
import { apiRequest } from "../../api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

interface TicketAttachmentsProps {
  ticketId: string;
  token: string;
  attachments?: Attachment[];
  onUploaded: () => void;
}

interface AttachmentPreview {
  signedUrl: string;
  thumbnailUrl: string | null;
  contentType: string;
}

const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export function TicketAttachments({
  ticketId,
  token,
  attachments = [],
  onUploaded,
}: TicketAttachmentsProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [previewUrls, setPreviewUrls] = useState<
    Record<string, AttachmentPreview>
  >({});
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  function handleFileChange(selectedFile: File | null) {
    setMessage("");

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setMessage("Only JPG, PNG, WEBP and PDF files are allowed.");
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_SIZE || selectedFile.size <= 0) {
      setMessage("File size must be between 1 byte and 10 MB.");
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }

  async function handleUpload() {
    if (!file) return;

    if (!supabase) {
      setMessage("Supabase frontend configuration is missing.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const uploadUrlResponse = await apiRequest<{
        upload: {
          attachment: Attachment;
          storageKey: string;
          token: string;
        };
      }>(
        `/api/v1/tickets/${ticketId}/attachments/upload-url`,
        {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        },
        token
      );

      if (!uploadUrlResponse.success || !uploadUrlResponse.data?.upload) {
        throw new Error(
          uploadUrlResponse.error || "Could not create upload URL."
        );
      }

      const upload = uploadUrlResponse.data.upload;

      const { error: storageError } = await supabase.storage
        .from("ticket-attachments")
        .uploadToSignedUrl(upload.storageKey, upload.token, file);

      if (storageError) {
        throw new Error(storageError.message);
      }

      const completeResponse = await apiRequest(
        `/api/v1/tickets/${ticketId}/attachments/complete`,
        {
          method: "POST",
          body: JSON.stringify({
            attachmentId: upload.attachment.id,
          }),
        },
        token
      );

      if (!completeResponse.success) {
        throw new Error(
          completeResponse.error || "Could not complete attachment upload."
        );
      }

      setFile(null);
      setMessage("File uploaded successfully.");
      onUploaded();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(attachment: Attachment) {
    if (attachment.status !== "READY") {
      setMessage("Attachment is not ready yet. Please wait.");
      return;
    }

    setPreviewLoading(attachment.id);
    setMessage("");

    try {
      const response = await apiRequest<{
        attachment: AttachmentPreview & {
          id: string;
          fileName: string;
          fileSize: number;
        };
      }>(
        `/api/v1/tickets/${ticketId}/attachments/${attachment.id}/download-url`,
        {
          method: "GET",
        },
        token
      );

      if (!response.success || !response.data?.attachment) {
        throw new Error(
          response.error || "Unable to load attachment preview."
        );
      }

      const result = response.data.attachment;

      setPreviewUrls((previous) => ({
        ...previous,
        [attachment.id]: {
          signedUrl: result.signedUrl,
          thumbnailUrl: result.thumbnailUrl,
          contentType: result.contentType,
        },
      }));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load attachment."
      );
    } finally {
      setPreviewLoading(null);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">
        Attachments
      </h3>

      <div className="mb-4">
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          disabled={loading}
          onChange={(event) =>
            handleFileChange(event.target.files?.[0] || null)
          }
          className="block w-full text-sm text-gray-700"
        />

        <p className="mt-2 text-xs text-gray-500">
          JPG, PNG, WEBP or PDF · Maximum size 10 MB
        </p>
      </div>

      {file && (
        <p className="mb-3 text-sm text-gray-700">
          Selected: {file.name} (
          {(file.size / (1024 * 1024)).toFixed(2)} MB)
        </p>
      )}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || loading}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload Attachment"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-gray-700" role="status">
          {message}
        </p>
      )}

      <div className="mt-6">
        <h4 className="mb-3 font-medium text-gray-900">
          Uploaded Files
        </h4>

        {attachments.length === 0 ? (
          <p className="text-sm text-gray-500">
            No attachments yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {attachments.map((attachment) => {
              const preview = previewUrls[attachment.id];
              const isImage = attachment.contentType.startsWith("image/");

              return (
                <li
                  key={attachment.id}
                  className="rounded-md border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {attachment.fileName}
                      </p>

                      <p className="text-xs text-gray-500">
                        {(attachment.fileSize / (1024 * 1024)).toFixed(2)} MB
                        {" · "}
                        {attachment.contentType}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                        {attachment.status}
                      </span>

                      {attachment.status === "READY" && (
                        <button
                          type="button"
                          onClick={() => handlePreview(attachment)}
                          disabled={previewLoading === attachment.id}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {previewLoading === attachment.id
                            ? "Loading..."
                            : preview
                              ? "Refresh Preview"
                              : "View File"}
                        </button>
                      )}
                    </div>
                  </div>

                  {attachment.status !== "READY" && (
                    <p className="mt-2 text-xs text-gray-500">
                      {attachment.status === "FAILED"
                        ? "Thumbnail generation failed."
                        : "File is being processed..."}
                    </p>
                  )}

                  {preview && (
                    <div className="mt-4 border-t border-gray-200 pt-4">
                      {isImage ? (
                        <img
                          src={preview.thumbnailUrl || preview.signedUrl}
                          alt={attachment.fileName}
                          className="max-h-72 max-w-full rounded-md border border-gray-200 object-contain"
                        />
                      ) : (
                        <iframe
                          src={preview.signedUrl}
                          title={attachment.fileName}
                          className="h-[500px] w-full rounded-md border border-gray-200"
                        />
                      )}

                      <a
                        href={preview.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
                      >
                        Open / Download File
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
