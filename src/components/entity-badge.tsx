"use client";

import type { Entity } from "@/lib/types";

const ENTITY_STYLES: Record<Entity, string> = {
  RTS: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PASKR:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  RTP: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  All: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

export function EntityBadge({ entity }: { entity: Entity }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ENTITY_STYLES[entity]}`}
    >
      {entity}
    </span>
  );
}
