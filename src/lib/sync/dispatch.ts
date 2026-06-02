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
  reorderTasks,
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
  createBook,
  updateBook,
  deleteBook,
  reorderBooks,
  setActiveBook,
} from "@/app/actions/books";
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
  extendReverseCascade,
} from "@/app/actions/goals";
import {
  logBodyWeight,
  updateBodyWeight,
  deleteBodyWeight,
} from "@/app/actions/body-weight";
import {
  createTodo,
  updateTodo,
  toggleTodo,
  setTodoStatus,
  deleteTodo,
  moveTodoToList,
  reorderTodos,
  createList,
  updateList,
  deleteList,
  reorderLists,
  createTag,
  updateTag,
  deleteTag,
  setTodoTags,
  moveTodoToSection,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} from "@/app/actions/todo";
import {
  createSplit,
  updateSplit,
  archiveSplit,
  unarchiveSplit,
  deleteSplit,
  reorderSplits,
  createExercise,
  updateExercise,
  archiveExercise,
  unarchiveExercise,
  deleteExercise,
  reorderExercises,
  assignExerciseToSplit,
  removeExerciseFromSplit,
  reorderSplitExercises,
  startOrGetWorkout,
  updateWorkout,
  deleteWorkout,
  logSet,
  updateSet,
  deleteSet,
} from "@/app/actions/gym";

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
  reorder_tasks: reorderTasks,

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

  // books (Phase 11.1)
  create_book: createBook,
  update_book: updateBook,
  delete_book: (args: { id: string }) => deleteBook(args.id),
  reorder_books: (args: { orderedIds: string[] }) => reorderBooks(args.orderedIds),
  set_active_book: (args: { bookId: string | null }) => setActiveBook(args.bookId),

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
  extend_reverse_cascade: extendReverseCascade,

  // gym (Phase 9)
  create_split: createSplit,
  update_split: updateSplit,
  archive_split: (args: { id: string }) => archiveSplit(args.id),
  unarchive_split: (args: { id: string }) => unarchiveSplit(args.id),
  delete_split: (args: { id: string }) => deleteSplit(args.id),
  reorder_splits: (args: { orderedIds: string[] }) => reorderSplits(args.orderedIds),

  create_exercise: createExercise,
  update_exercise: updateExercise,
  archive_exercise: (args: { id: string }) => archiveExercise(args.id),
  unarchive_exercise: (args: { id: string }) => unarchiveExercise(args.id),
  delete_exercise: (args: { id: string }) => deleteExercise(args.id),
  reorder_exercises: (args: { orderedIds: string[] }) => reorderExercises(args.orderedIds),

  assign_exercise_to_split: assignExerciseToSplit,
  remove_exercise_from_split: removeExerciseFromSplit,
  reorder_split_exercises: reorderSplitExercises,

  start_workout: startOrGetWorkout,
  update_workout: updateWorkout,
  delete_workout: (args: { id: string }) => deleteWorkout(args.id),

  log_set: logSet,
  update_set: updateSet,
  delete_set: (args: { id: string }) => deleteSet(args.id),

  // body weight (Phase 9.2)
  log_body_weight: logBodyWeight,
  update_body_weight: updateBodyWeight,
  delete_body_weight: (args: { id: string }) => deleteBodyWeight(args.id),

  // todo (Phase 13)
  create_todo: createTodo,
  update_todo: updateTodo,
  toggle_todo: toggleTodo,
  set_todo_status: setTodoStatus,
  delete_todo: (args: { id: string }) => deleteTodo(args.id),
  move_todo_to_list: moveTodoToList,
  reorder_todos: reorderTodos,
  create_list: createList,
  update_list: updateList,
  delete_list: (args: { id: string }) => deleteList(args.id),
  reorder_lists: reorderLists,
  create_tag: createTag,
  update_tag: updateTag,
  delete_tag: (args: { id: string }) => deleteTag(args.id),
  set_todo_tags: setTodoTags,
  move_todo_to_section: moveTodoToSection,
  create_section: createSection,
  update_section: updateSection,
  delete_section: (args: { id: string }) => deleteSection(args.id),
  reorder_sections: reorderSections,
};

export type MutationKind = keyof typeof DISPATCH;
