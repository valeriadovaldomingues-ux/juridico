import { createClient } from "@/lib/supabase/client";

export async function getKanbanTasks() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("kanban_tasks")
    .select("*");

  if (error) {
    console.error("Erro ao buscar tarefas:", error);
    return [];
  }

  return data;
}

export function getPersonalColumns(tasks: any[], userId: string) {
  const statuses = [
    { key: "a_fazer", label: "A Fazer" },
    { key: "fazendo", label: "Fazendo" },
    { key: "com_pendencia", label: "Com Pendência" },
    { key: "concluido", label: "Concluído" },
  ];

  return statuses.map((status) => ({
    status: status.key,
    label: status.label,
    tasks: tasks.filter(
      (t) =>
        t.responsavel_id === userId &&
        t.status === status.key
    ),
  }));
}

export async function getOfficeColumnsFromDB() {
  const supabase = createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nome, cor_kanban");

  const { data: tasks } = await supabase
    .from("kanban_tasks")
    .select("*");

  if (!profiles || !tasks) return [];

  const columns = profiles.map((profile) => ({
    profile,
    tasks: tasks.filter(
      (t) => t.responsavel_id === profile.id
    ),
  }));

  const semResponsavel = tasks.filter((t) => !t.responsavel_id);

  return columns;
}