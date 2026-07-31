"use client";

import { useState } from "react";
import type { CloseStepDef, CloseTaskCompletion } from "@/lib/types";
import { EntityBadge } from "./entity-badge";
import { supabase } from "@/lib/supabase";

export function CloseStep({
  step,
  periodId,
  completion,
  onUpdate,
}: {
  step: CloseStepDef;
  periodId: string;
  completion: CloseTaskCompletion | undefined;
  onUpdate: () => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(completion?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const completed = completion?.completed ?? false;

  async function toggleCompleted() {
    setSaving(true);
    const now = new Date().toISOString();
    const newCompleted = !completed;

    if (completion) {
      await supabase
        .from("close_task_completions")
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? now : null,
        })
        .eq("id", completion.id);
    } else {
      await supabase.from("close_task_completions").insert({
        period_id: periodId,
        step_index: step.index,
        completed: true,
        completed_at: now,
        notes: null,
      });
    }
    setSaving(false);
    onUpdate();
  }

  async function saveNotes() {
    if (!completion) {
      await supabase.from("close_task_completions").insert({
        period_id: periodId,
        step_index: step.index,
        completed: false,
        notes: notes || null,
      });
    } else {
      await supabase
        .from("close_task_completions")
        .update({ notes: notes || null })
        .eq("id", completion.id);
    }
    onUpdate();
  }

  return (
    <div
      className={`group flex flex-col border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
        completed ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
        <button
          onClick={toggleCompleted}
          disabled={saving}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            completed
              ? "bg-green-500 border-green-500"
              : "border-gray-300 dark:border-gray-600 hover:border-green-400"
          }`}
        >
          {completed && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <span
          className={`flex-1 text-sm ${
            completed
              ? "line-through text-gray-400 dark:text-gray-500"
              : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {step.description}
        </span>

        <EntityBadge entity={step.entity} />

        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
          {step.category}
        </span>

        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
            completion?.notes
              ? "text-blue-500"
              : "text-gray-400 opacity-0 group-hover:opacity-100"
          }`}
          title="Notes"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zM3.5 3a.5.5 0 00-.5.5v9a.5.5 0 00.5.5h9a.5.5 0 00.5-.5v-9a.5.5 0 00-.5-.5h-9z" />
            <path d="M5 5.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" />
          </svg>
        </button>
      </div>

      {showNotes && (
        <div className="px-4 pb-3 pl-12">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes..."
            rows={2}
            className="w-full text-sm p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
}
