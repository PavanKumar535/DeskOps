
import { z } from "zod";

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters"),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .optional()
    .default("MEDIUM"),
  category: z.string().trim().optional(),
  propertyId: z.string().uuid("Invalid property ID format"),
  unitId: z.string().uuid("Invalid unit ID format"),
});

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

export const triageTicketSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().trim().optional(),
});

export const assignTicketSchema = z.object({
  technicianId: z.string().uuid("Invalid technician user ID format"),
});

export const resolveTicketSchema = z.object({
  resolutionNotes: z.string().trim().optional(),
});

export const reopenTicketSchema = z.object({
  reason: z.string().trim().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type TriageTicketInput = z.infer<typeof triageTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>;
export type ReopenTicketInput = z.infer<typeof reopenTicketSchema>;
