"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveSubmission(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const submissionId = formData.get("submission_id") as string;
  const caseTypeId = formData.get("case_type_id") as string;
  const areaOfDutyId = formData.get("area_of_duty_id") as string;
  const rotationId = (formData.get("rotation_id") as string) || null;
  const uploadId = (formData.get("upload_id") as string) || null;
  const clinicalInstructorId = (formData.get("clinical_instructor_id") as string) || null;
  const date = formData.get("date") as string;
  const notes = ((formData.get("notes") as string) ?? "").trim() || null;

  if (!submissionId || !caseTypeId || !areaOfDutyId || !date) {
    return { error: "All required fields must be filled." };
  }

  // Fetch submission
  const { data: submission, error: fetchErr } = await supabase
    .from("case_submissions")
    .select("id, student_id, assignment_id, status")
    .eq("id", submissionId)
    .single();

  if (fetchErr || !submission) return { error: "Submission not found." };
  if (submission.status !== "pending") return { error: "Submission is not pending." };

  // Create case log
  const { error: logError } = await supabase.from("case_logs").insert({
    student_id: submission.student_id,
    case_type_id: caseTypeId,
    area_of_duty_id: areaOfDutyId,
    rotation_id: rotationId,
    upload_id: uploadId,
    clinical_instructor_id: clinicalInstructorId,
    date,
    notes,
    logged_by: user.id,
  });

  if (logError) {
    if (logError.code === "23505") {
      return {
        error:
          "A case log already exists for this student, date, and case type.",
      };
    }
    return { error: logError.message };
  }

  // Mark upload as processed if linked
  if (uploadId) {
    await supabase
      .from("uploads")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", uploadId);
  }

  // Complete the linked assignment if any
  if (submission.assignment_id) {
    await supabase
      .from("assignments")
      .update({ status: "completed" })
      .eq("id", submission.assignment_id)
      .eq("status", "scheduled");
  }

  // Mark submission approved
  await supabase
    .from("case_submissions")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  // Audit log
  await supabase.from("audit_logs").insert({
    action_type: "case_submission_approved",
    performed_by: user.id,
    target_table: "case_submissions",
    target_id: submissionId,
    details: {
      student_id: submission.student_id,
      case_type_id: caseTypeId,
      date,
    },
  });

  revalidatePath("/admin/cases/review");
  redirect("/admin/cases/review");
}

export async function rejectSubmission(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const submissionId = formData.get("submission_id") as string;
  const adminNote =
    ((formData.get("admin_note") as string) ?? "").trim() || null;

  if (!submissionId) return { error: "Missing submission ID." };

  const { error } = await supabase
    .from("case_submissions")
    .update({
      status: "rejected",
      admin_note: adminNote,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .eq("status", "pending");

  if (error) return { error: error.message };

  await supabase.from("audit_logs").insert({
    action_type: "case_submission_rejected",
    performed_by: user.id,
    target_table: "case_submissions",
    target_id: submissionId,
    details: { admin_note: adminNote },
  });

  revalidatePath("/admin/cases/review");
  redirect("/admin/cases/review");
}

export async function logCase(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized." };

  const studentId = formData.get("student_id") as string;
  const caseTypeId = formData.get("case_type_id") as string;
  const areaOfDutyId = formData.get("area_of_duty_id") as string;
  const date = formData.get("date") as string;
  const rotationId = (formData.get("rotation_id") as string) || null;
  const clinicalInstructorId = (formData.get("clinical_instructor_id") as string) || null;
  const notes = ((formData.get("notes") as string) ?? "").trim() || null;

  if (!studentId || !caseTypeId || !areaOfDutyId) {
    return { error: "Student, case type, and area of duty are all required." };
  }

  const { data: caseLog, error: logError } = await supabase
    .from("case_logs")
    .insert({
      student_id: studentId,
      case_type_id: caseTypeId,
      area_of_duty_id: areaOfDutyId,
      rotation_id: rotationId,
      clinical_instructor_id: clinicalInstructorId,
      upload_id: null,
      date: date || null,
      notes,
      logged_by: user.id,
    })
    .select("id")
    .single();

  if (logError) {
    if (logError.code === "23505") {
      return { error: "A case log already exists for this student, date and case type." };
    }
    return { error: logError.message };
  }

  await supabase.from("audit_logs").insert({
    action_type: "case_log_created",
    performed_by: user.id,
    target_table: "case_logs",
    target_id: caseLog.id,
    details: { student_id: studentId, case_type_id: caseTypeId, date, manual: true },
  });

  // Auto-complete a matching open assignment (only possible when a date is provided)
  const matchingAssignment = date
    ? (await supabase
        .from("assignments")
        .select("id")
        .eq("student_id", studentId)
        .eq("area_of_duty_id", areaOfDutyId)
        .eq("scheduled_date", date)
        .in("status", ["scheduled", "cancel_requested"])
        .limit(1)
        .maybeSingle()
      ).data
    : null;

  let assignmentCompleted = false;
  if (matchingAssignment) {
    const { error: updateErr } = await supabase
      .from("assignments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", matchingAssignment.id);
    if (!updateErr) {
      assignmentCompleted = true;
      await supabase.from("audit_logs").insert({
        action_type: "assignment_completed",
        performed_by: user.id,
        target_table: "assignments",
        target_id: matchingAssignment.id,
        details: { auto_completed_via: "manual_case_log", case_log_id: caseLog.id },
      });
    }
  }

  revalidatePath("/admin/cases/review");
  return { success: true, assignmentCompleted };
}
