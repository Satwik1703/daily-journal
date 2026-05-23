// Server-side: maps mutation kinds to the underlying server action functions.
// Used by /api/sync to dispatch a queued mutation in a single POST.

import {
  createHabit,
  updateHabit,
  archiveHabit,
  unarchiveHabit,
  reorderHabits,
  toggleHabitForDate,
  logHabitValue,
  deleteHabitValueLog,
} from "@/app/actions/habits";
import { saveJournalEntry } from "@/app/actions/journal";
import {
  addTask,
  toggleTask,
  updateTaskText,
  deleteTask,
  moveJournalTask,
} from "@/app/actions/journal-tasks";
import {
  createQuestion,
  updateQuestion,
  archiveQuestion,
  unarchiveQuestion,
  reorderQuestions,
} from "@/app/actions/journal-questions";
import {
  createSession,
  updateSession,
  deleteSession,
} from "@/app/actions/pomodoro";
import {
  createCategory,
  updateCategory,
  archiveCategory,
  unarchiveCategory,
  reorderCategories,
} from "@/app/actions/pomodoro-categories";
import { setPomodoroSound } from "@/app/actions/settings";
import {
  createGoal,
  updateGoalCascade,
  deleteGoalCascade,
  archiveGoal,
  unarchiveGoal,
  setGoalPinned,
  logProgress,
  deleteProgress,
  addChecklistItem,
  updateChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  saveReflection,
} from "@/app/actions/goals";
import { createWorkout, deleteWorkout } from "@/app/actions/gym";

type AnyAction = (input: never) => Promise<unknown>;

export const DISPATCH: Record<string, AnyAction> = {
  // habits
  create_habit: createHabit,
  update_habit: updateHabit,
  archive_habit: (args: { id: string }) => archiveHabit(args.id),
  unarchive_habit: (args: { id: string }) => unarchiveHabit(args.id),
  reorder_habits: (args: { orderedIds: string[] }) => reorderHabits(args.orderedIds),
  toggle_habit: (args: { habitId: string; date: string }) =>
    toggleHabitForDate(args.habitId, args.date),
  log_habit_value: logHabitValue,
  delete_habit_value_log: (args: { id: string }) => deleteHabitValueLog(args.id),

  // journal
  save_journal_entry: saveJournalEntry,
  add_task: addTask,
  toggle_task: (args: { id: string }) => toggleTask(args.id),
  update_task_text: updateTaskText,
  delete_task: (args: { id: string }) => deleteTask(args.id),
  move_task: moveJournalTask,

  // journal questions (settings)
  create_question: createQuestion,
  update_question: updateQuestion,
  archive_question: (args: { id: string }) => archiveQuestion(args.id),
  unarchive_question: (args: { id: string }) => unarchiveQuestion(args.id),
  reorder_questions: (args: { orderedIds: string[] }) => reorderQuestions(args.orderedIds),

  // pomodoro
  create_session: createSession,
  update_session: updateSession,
  delete_session: (args: { id: string }) => deleteSession(args.id),

  // pomo categories (settings)
  create_category: createCategory,
  update_category: updateCategory,
  archive_category: (args: { id: string }) => archiveCategory(args.id),
  unarchive_category: (args: { id: string }) => unarchiveCategory(args.id),
  reorder_categories: (args: { ids: string[] }) => reorderCategories(args.ids),

  // settings
  set_pomo_sound: (args: { soundId: string }) => setPomodoroSound(args.soundId),

  // goals
  create_goal: createGoal,
  update_goal_cascade: updateGoalCascade,
  delete_goal_cascade: (args: { id: string }) => deleteGoalCascade(args.id),
  archive_goal: (args: { id: string }) => archiveGoal(args.id),
  unarchive_goal: (args: { id: string }) => unarchiveGoal(args.id),
  set_goal_pinned: setGoalPinned,
  log_progress: logProgress,
  delete_progress: (args: { id: string }) => deleteProgress(args.id),
  add_checklist_item: addChecklistItem,
  update_checklist_item: updateChecklistItem,
  toggle_checklist_item: (args: { itemId: string }) => toggleChecklistItem(args.itemId),
  delete_checklist_item: (args: { id: string }) => deleteChecklistItem(args.id),
  save_reflection: saveReflection,

  // gym
  create_workout: createWorkout,
  delete_workout: (args: { id: string }) => deleteWorkout(args.id),
};

export type MutationKind = keyof typeof DISPATCH;
