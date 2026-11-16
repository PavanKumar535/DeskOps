
import { z } from "zod";

export const updateTicketStatusSchema = z.object({
  status: z.enum(
    [
      "NEW",
      "TRIAGED",
      "ASSIGNED",
      "IN_PROGRESS",
      "ON_HOLD",
      "RESOLVED",
      "CLOSED",
      "REOPENED",
    ],
    {
      message: "Invalid ticket status. Please provide a valid status.",
    }
  ),
});

export type UpdateTicketStatusInput = z.infer<
  typeof updateTicketStatusSchema
>;
