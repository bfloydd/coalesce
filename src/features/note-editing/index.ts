// ============================
// Note Editing Slice Exports
// ============================

export { NoteEditingSlice } from './NoteEditingSlice';
export { ContentEditor } from './ContentEditor';
export { HeadingManager } from './HeadingManager';
export { FileModifier } from './FileModifier';
export { HeadingPopupComponent } from './HeadingPopupComponent';

// Export interfaces for external use
export type { INoteEditingSlice } from '../shared-contracts/slice-interfaces';
export type { IContentEditor, IHeadingManager, IFileModifier } from './types';