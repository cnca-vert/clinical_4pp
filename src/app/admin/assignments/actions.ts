"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendAssignmentEmail } from "@/lib/actions/email";

export type ConflictWarning = {
  type?: "same_day" | "location_overexposure" | "out_of_semester";
  studentName: string;
  reason: string;
};

export async function createAssignment(formData: FormData) {
  const studentId = (formData.get("student_id") as string) || null;
  const rosterId = (formData.get("roster_id") as string) || null;
  const areaOfDutyId = formData.get("area_of_duty_id") as string;
  const scheduledDate = formData.get("scheduled_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const shiftId = (formData.get("shift_id") as string) || null;
  const rotationId = (formData.get("rotation_id") as string) || null;
  const clinicalInstructorId = (formData.get("clinical_instructor_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const inclusiveDaysRaw = (formData.get("inclusive_days") as string) || "[]";
  const inclusiveDays = JSON.parse(inclusiveDaysRaw) as number[];

  if (!studentId && !rosterId) {
    return { error: "No student or roster entry selected." };
  }

  if (!areaOfDutyId || !scheduledDate) {
    return { error: "All fields are required." };
  }

  if (endDate && endDate < scheduledDate) {
    return { error: "End date cannot be before start date." };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({
      ...(studentId ? { student_id: studentId } : {}),
      ...(rosterId ? { roster_id: rosterId } : {}),
      area_of_duty_id: areaOfDutyId,
      shift_id: shiftId,
      rotation_id: rotationId,
      clinical_instructor_id: clinicalInstructorId,
      scheduled_date: scheduledDate,
      end_date: endDate,
      inclusive_days: inclusiveDays,
      assigned_by: user.id,
      status: "scheduled",
      notes,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    action_type: "assignment_created",
    performed_by: user.id,
    target_table: "assignments",
    target_id: assignment.id,
    details: { student_id: studentId, roster_id: rosterId, scheduled_date: scheduledDate, end_date: endDate, shift_id: shiftId, rotation_id: rotationId },
  });

  // Send email notification (non-blocking, only when we have a real student)
  if (studentId) {
    const [{ data: loc }, { data: shiftRow }] = await Promise.all([
      supabase.from("areas_of_duty").select("name").eq("id", areaOfDutyId).single(),
      shiftId ? supabase.from("shifts").select("name").eq("id", shiftId).single() : Promise.resolve({ data: null }),
    ]);
    sendAssignmentEmail(studentId, {
      locationName: loc?.name ?? "Unknown",
      shiftName: shiftRow?.name ?? null,
      scheduledDate,
      endDate,
      notes,
    }).catch(() => {});
  }

  revalidatePath("/admin/assignments");
  return { success: true };
}

export async function bulkAssign(formData: FormData) {
  const studentIdsRaw = (formData.get("student_ids") as string) || "[]";
  const rosterIdsRaw = (formData.get("roster_ids") as string) || "[]";
  const areaOfDutyId = formData.get("area_of_duty_id") as string;
  const scheduledDate = formData.get("scheduled_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const shiftId = (formData.get("shift_id") as string) || null;
  const rotationId = (formData.get("rotation_id") as string) || null;
  const clinicalInstructorId = (formData.get("clinical_instructor_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const inclusiveDaysRaw = (formData.get("inclusive_days") as string) || "[]";
  const inclusiveDays = JSON.parse(inclusiveDaysRaw) as number[];

  if (!areaOfDutyId || !scheduledDate) {
    return { error: "All fields are required." };
  }

  if (endDate && endDate < scheduledDate) {
    return { error: "End date cannot be before start date." };
  }

  const studentIds = JSON.parse(studentIdsRaw) as string[];
  const rosterIds = JSON.parse(rosterIdsRaw) as string[];
  if (studentIds.length === 0 && rosterIds.length === 0) return { error: "No students selected." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const rows = [
    ...studentIds.map((sid) => ({
      student_id: sid,
      area_of_duty_id: areaOfDutyId,
      shift_id: shiftId,
      rotation_id: rotationId,
      clinical_instructor_id: clinicalInstructorId,
      scheduled_date: scheduledDate,
      end_date: endDate,
      inclusive_days: inclusiveDays,
      assigned_by: user.id,
      status: "scheduled" as const,
      notes,
    })),
    ...rosterIds.map((rid) => ({
      roster_id: rid,
      area_of_duty_id: areaOfDutyId,
      shift_id: shiftId,
      rotation_id: rotationId,
      clinical_instructor_id: clinicalInstructorId,
      scheduled_date: scheduledDate,
      end_date: endDate,
      inclusive_days: inclusiveDays,
      assigned_by: user.id,
      status: "scheduled" as const,
      notes,
    })),
  ];

  const { data: inserted, error } = await supabase
    .from("assignments")
    .insert(rows)
    .select("id");

  if (error) return { error: error.message };

  // Audit log for bulk
  if (inserted) {
    await supabase.from("audit_logs").insert(
      inserted.map((a) => ({
        action_type: "assignment_created",
        performed_by: user.id,
        target_table: "assignments",
        target_id: a.id,
        details: { scheduled_date: scheduledDate, end_date: endDate, shift_id: shiftId, rotation_id: rotationId, bulk: true },
      })),
    );
  }

  // Send email notifications (non-blocking, only for real student profiles)
  if (studentIds.length > 0) {
    const [{ data: loc }, { data: shiftRow }] = await Promise.all([
      supabase.from("areas_of_duty").select("name").eq("id", areaOfDutyId).single(),
      shiftId ? supabase.from("shifts").select("name").eq("id", shiftId).single() : Promise.resolve({ data: null }),
    ]);
    for (const sid of studentIds) {
      sendAssignmentEmail(sid, {
        locationName: loc?.name ?? "Unknown",
        shiftName: shiftRow?.name ?? null,
        scheduledDate,
        endDate,
        notes,
      }).catch(() => {});
    }
  }

  revalidatePath("/admin/assignments");
  return { success: true, count: studentIds.length + rosterIds.length };
}

export async function checkConflicts(
  studentIds: string[],
  scheduledDate: string,
  areaOfDutyId: string,
): Promise<ConflictWarning[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createClient();
  const warnings: ConflictWarning[] = [];

  // 1. Same-day conflict
  const { data: sameDayAssignments } = await supabase
    .from("assignments")
    .select("student_id, student:profiles!student_id(full_name)")
    .in("student_id", studentIds)
    .eq("scheduled_date", scheduledDate)
    .eq("status", "scheduled");

  for (const a of sameDayAssignments ?? []) {
    const name = Array.isArray(a.student) ? a.student[0]?.full_name : (a.student as { full_name: string } | null)?.full_name;
    warnings.push({
      studentName: name ?? "Unknown",
      reason: "Already has an assignment on this date",
    });
  }

  // 2. Repeated location (3+ times at same location)
  const { data: locationCounts } = await supabase
    .from("assignments")
    .select("student_id, student:profiles!student_id(full_name)")
    .in("student_id", studentIds)
    .eq("area_of_duty_id", areaOfDutyId)
    .in("status", ["scheduled", "completed"]);

  const locCountMap: Record<string, { count: number; name: string }> = {};
  for (const a of locationCounts ?? []) {
    const name = Array.isArray(a.student) ? a.student[0]?.full_name : (a.student as { full_name: string } | null)?.full_name;
    if (!locCountMap[a.student_id]) locCountMap[a.student_id] = { count: 0, name: name ?? "Unknown" };
    locCountMap[a.student_id].count++;
  }
  for (const [, val] of Object.entries(locCountMap)) {
    if (val.count >= 3) {
      warnings.push({
        studentName: val.name,
        reason: `Has been to this area of duty ${val.count} times already`,
      });
    }
  }

  return warnings;
}

export async function updateAssignmentStatus(formData: FormData) {
  const assignmentId = formData.get("assignment_id") as string;
  const status = formData.get("status") as string;
  if (!assignmentId || !status) return;

  const supabase = await createClient();
  await supabase
    .from("assignments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", assignmentId);

  revalidatePath("/admin/assignments");
}
