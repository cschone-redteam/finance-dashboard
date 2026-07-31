"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getTasksByCadence,
  ACTIVITY_DUTIES,
  ACTIVE_PROJECTS,
  CADENCE_TASKS,
  GUIDES,
  type CadenceTask,
  type Cadence,
  type GuideKey,
} from "@/lib/cadence-tasks";
import { supabase } from "@/lib/supabase";

const CADENCE_GROUPS = getTasksByCadence();

const CADENCE_ICONS: Record<string, React.ReactNode> = {
  daily: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  ),
  weekly: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  "semi-monthly": (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  monthly: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
    </svg>
  ),
  annual: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.016 6.016 0 01-4.27 1.772 6.016 6.016 0 01-4.27-1.772" />
    </svg>
  ),
};

const CADENCE_COLORS: Record<string, string> = {
  daily: "text-amber-600 dark:text-amber-400",
  weekly: "text-blue-600 dark:text-blue-400",
  "semi-monthly": "text-violet-600 dark:text-violet-400",
  monthly: "text-emerald-600 dark:text-emerald-400",
  annual: "text-rose-600 dark:text-rose-400",
};

const CADENCE_BG: Record<string, string> = {
  daily: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50",
  weekly: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50",
  "semi-monthly": "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50",
  monthly: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50",
  annual: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50",
};

const PROJECT_STATUS_STYLES: Record<string, string> = {
  "Wrapping up": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Starting": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "In progress": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Blocked": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "Not started": "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const CATEGORY_BADGE: Record<string, string> = {
  Communication: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  Banking: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  AP: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  AR: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  Payroll: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  GL: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  Reconciliation: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  Reporting: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  Consolidation: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Phone: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  Email: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  Recurly: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300",
  "Sales Tax": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Audit: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  "Tax Returns": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_BADGE[category] ?? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style}`}>
      {category}
    </span>
  );
}

function TimingBadge({ timing }: { timing: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {timing}
    </span>
  );
}

function Checkbox({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
        checked
          ? "bg-green-500 border-green-500"
          : "border-gray-300 dark:border-gray-600 hover:border-green-400"
      }`}
    >
      {checked && (
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
  );
}

function NotesPanel({
  task,
  userNote,
  onSaveNote,
}: {
  task: CadenceTask;
  userNote: string;
  onSaveNote: (taskId: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(userNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(userNote);
  }, [userNote]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const hasGuideNotes = task.notes && task.notes.length > 0;
  const hasUserNote = userNote.trim().length > 0;
  const hasGuides = task.guides && task.guides.length > 0;

  return (
    <div className="mt-1 ml-8 mr-4 mb-2 space-y-2">
      {/* Guide links */}
      {hasGuides && (
        <div className="flex flex-wrap gap-1.5">
          {task.guides!.map((key) => {
            const guide = GUIDES[key];
            return (
              <a
                key={key}
                href={`/guides/${encodeURIComponent(guide.file)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {guide.name}
              </a>
            );
          })}
        </div>
      )}

      {/* Guide notes */}
      {hasGuideNotes && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-md px-3 py-2 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            From guides
          </div>
          {task.notes!.map((note, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {note}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* User note */}
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
            placeholder="Add your own notes..."
            className="w-full text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 min-h-[60px]"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setDraft(userNote);
                setEditing(false);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSaveNote(task.id, draft);
                setEditing(false);
              }}
              className="text-xs text-white bg-blue-500 hover:bg-blue-600 rounded px-3 py-1 font-medium"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          {hasUserNote ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              <span className="text-gray-600 dark:text-gray-400 italic">{userNote}</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add note
            </>
          )}
        </button>
      )}
    </div>
  );
}

function getTaskIdsForCadence(cadence: Cadence): string[] {
  return CADENCE_TASKS.filter((t) => t.cadence === cadence).map((t) => t.id);
}

type View = "cadence" | "duties" | "projects";

export function CadencePanel() {
  const [view, setView] = useState<View>("cadence");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [userNotes, setUserNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchChecked = useCallback(async () => {
    const [completions, notes] = await Promise.all([
      supabase.from("cadence_task_completions").select("task_id"),
      supabase.from("cadence_task_notes").select("task_id, note"),
    ]);
    setCheckedIds(new Set((completions.data ?? []).map((r: { task_id: string }) => r.task_id)));
    const notesMap: Record<string, string> = {};
    for (const r of (notes.data ?? []) as { task_id: string; note: string }[]) {
      notesMap[r.task_id] = r.note;
    }
    setUserNotes(notesMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChecked();
  }, [fetchChecked]);

  async function toggleTask(taskId: string) {
    const isChecked = checkedIds.has(taskId);
    const next = new Set(checkedIds);

    if (isChecked) {
      next.delete(taskId);
      setCheckedIds(next);
      await supabase
        .from("cadence_task_completions")
        .delete()
        .eq("task_id", taskId);
    } else {
      next.add(taskId);
      setCheckedIds(next);
      await supabase
        .from("cadence_task_completions")
        .insert({ task_id: taskId });
    }
  }

  async function clearCadence(cadence: Cadence) {
    const ids = getTaskIdsForCadence(cadence);
    const next = new Set(checkedIds);
    ids.forEach((id) => next.delete(id));
    setCheckedIds(next);
    await supabase
      .from("cadence_task_completions")
      .delete()
      .in("task_id", ids);
  }

  async function saveNote(taskId: string, note: string) {
    setUserNotes((prev) => ({ ...prev, [taskId]: note }));
    if (note.trim() === "") {
      await supabase.from("cadence_task_notes").delete().eq("task_id", taskId);
    } else {
      await supabase
        .from("cadence_task_notes")
        .upsert({ task_id: taskId, note, updated_at: new Date().toISOString() }, { onConflict: "task_id" });
    }
  }

  return (
    <div>
      {/* Sub-navigation */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: "cadence" as const, label: "By Cadence" },
          { key: "duties" as const, label: "By Category" },
          { key: "projects" as const, label: "Projects" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              view === tab.key
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "cadence" && (
        <CadenceView
          checkedIds={checkedIds}
          onToggle={toggleTask}
          onClear={clearCadence}
          userNotes={userNotes}
          onSaveNote={saveNote}
          loading={loading}
        />
      )}
      {view === "duties" && <DutiesView />}
      {view === "projects" && <ProjectsView />}
    </div>
  );
}

type TaskOrGroup =
  | { kind: "task"; task: CadenceTask }
  | { kind: "group"; name: string; tasks: CadenceTask[] };

function buildTaskRows(tasks: CadenceTask[]): TaskOrGroup[] {
  const rows: TaskOrGroup[] = [];
  const seenGroups = new Set<string>();

  for (const task of tasks) {
    if (!task.group) {
      rows.push({ kind: "task", task });
    } else if (!seenGroups.has(task.group)) {
      seenGroups.add(task.group);
      rows.push({
        kind: "group",
        name: task.group,
        tasks: tasks.filter((t) => t.group === task.group),
      });
    }
  }
  return rows;
}

function hasNotes(task: CadenceTask, userNotes: Record<string, string>): boolean {
  return (task.notes && task.notes.length > 0) || (task.guides && task.guides.length > 0) || (userNotes[task.id]?.trim().length > 0);
}

function TaskRow({
  task,
  checked,
  onToggle,
  userNotes,
  onSaveNote,
  indent,
}: {
  task: CadenceTask;
  checked: boolean;
  onToggle: (id: string) => void;
  userNotes: Record<string, string>;
  onSaveNote: (taskId: string, note: string) => void;
  indent?: boolean;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const taskHasNotes = hasNotes(task, userNotes);

  return (
    <div className={`border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${checked ? "opacity-60" : ""}`}>
      <div className={`flex items-center gap-3 ${indent ? "pl-11 pr-4" : "px-4"} py-2.5`}>
        <Checkbox checked={checked} onClick={() => onToggle(task.id)} />
        <span
          className={`text-sm flex-1 ${
            checked
              ? "line-through text-gray-400 dark:text-gray-500"
              : indent
                ? "text-gray-600 dark:text-gray-400"
                : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {task.description}
        </span>
        {task.timing && <TimingBadge timing={task.timing} />}
        <button
          onClick={() => setNotesOpen(!notesOpen)}
          className={`relative flex-shrink-0 p-1 rounded transition-colors ${
            notesOpen
              ? "text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
              : taskHasNotes
                ? "text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
                : "text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500"
          }`}
          title={notesOpen ? "Hide notes" : "Show notes"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          {taskHasNotes && !notesOpen && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </button>
        {!indent && <CategoryBadge category={task.category} />}
      </div>
      {notesOpen && (
        <NotesPanel
          task={task}
          userNote={userNotes[task.id] ?? ""}
          onSaveNote={onSaveNote}
        />
      )}
    </div>
  );
}

function CadenceView({
  checkedIds,
  onToggle,
  onClear,
  userNotes,
  onSaveNote,
  loading,
}: {
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: (cadence: Cadence) => void;
  userNotes: Record<string, string>;
  onSaveNote: (taskId: string, note: string) => void;
  loading: boolean;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {CADENCE_GROUPS.map((group) => {
        const rows = buildTaskRows(group.tasks);
        const checkedCount = group.tasks.filter((t) => checkedIds.has(t.id)).length;
        const totalCount = group.tasks.length;

        return (
          <div
            key={group.cadence}
            className={`rounded-lg border overflow-hidden ${CADENCE_BG[group.cadence]}`}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-inherit">
              <span className={CADENCE_COLORS[group.cadence]}>
                {CADENCE_ICONS[group.cadence]}
              </span>
              <h3 className={`text-sm font-bold ${CADENCE_COLORS[group.cadence]}`}>
                {group.label}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
                {checkedCount}/{totalCount}
              </span>
              {checkedCount > 0 && (
                <button
                  onClick={() => onClear(group.cadence)}
                  className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="h-1 bg-gray-200/50 dark:bg-gray-700/50">
                <div
                  className={`h-full transition-all ${
                    checkedCount === totalCount ? "bg-green-500" : "bg-green-400/70"
                  }`}
                  style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                />
              </div>
            )}

            <div className="bg-white/60 dark:bg-gray-900/60">
              {rows.map((row) => {
                if (row.kind === "task") {
                  return (
                    <TaskRow
                      key={row.task.id}
                      task={row.task}
                      checked={checkedIds.has(row.task.id)}
                      onToggle={onToggle}
                      userNotes={userNotes}
                      onSaveNote={onSaveNote}
                    />
                  );
                }

                const isOpen = expandedGroups.has(row.name);
                const groupCheckedCount = row.tasks.filter((t) =>
                  checkedIds.has(t.id)
                ).length;
                const allChecked = groupCheckedCount === row.tasks.length;

                return (
                  <div
                    key={row.name}
                    className={`border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      allChecked ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      <Checkbox
                        checked={allChecked}
                        onClick={() => {
                          if (allChecked) {
                            row.tasks.forEach((t) => {
                              if (checkedIds.has(t.id)) onToggle(t.id);
                            });
                          } else {
                            row.tasks.forEach((t) => {
                              if (!checkedIds.has(t.id)) onToggle(t.id);
                            });
                          }
                        }}
                      />
                      <button
                        onClick={() => toggleGroup(row.name)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <svg
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        <span
                          className={`text-sm font-medium text-left ${
                            allChecked
                              ? "line-through text-gray-400 dark:text-gray-500"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {row.name}
                        </span>
                      </button>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mr-1">
                        {groupCheckedCount}/{row.tasks.length}
                      </span>
                      <CategoryBadge category={row.tasks[0].category} />
                    </div>

                    {isOpen && (
                      <div className="bg-gray-50/50 dark:bg-gray-800/30">
                        {row.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            checked={checkedIds.has(task.id)}
                            onToggle={onToggle}
                            userNotes={userNotes}
                            onSaveNote={onSaveNote}
                            indent
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DutiesView() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {ACTIVITY_DUTIES.map((cat) => {
        const isOpen = expanded.has(cat.name);
        return (
          <div
            key={cat.name}
            className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
          >
            <button
              onClick={() => toggle(cat.name)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {cat.name}
                </h3>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {cat.duties.length} {cat.duties.length === 1 ? "item" : "items"}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 dark:border-gray-800">
                {cat.duties.map((duty, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0"
                  >
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {duty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProjectsView() {
  return (
    <div className="space-y-3">
      {ACTIVE_PROJECTS.map((project) => (
        <div
          key={project.id}
          className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 flex items-start justify-between gap-4"
        >
          <span className="text-sm text-gray-800 dark:text-gray-200">
            {project.name}
          </span>
          <span
            className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              PROJECT_STATUS_STYLES[project.status] ?? PROJECT_STATUS_STYLES["Not started"]
            }`}
          >
            {project.status}
          </span>
        </div>
      ))}
    </div>
  );
}
