// ============================
// View Integration Slice Types
// ============================

import { App, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';

// ============================
// View Manager Interface
// ============================

export interface IViewManager {
    /**
     * Initialize view for a file
     */
    initializeView(file: TFile, view: MarkdownView): Promise<void>;
    
    /**
     * Cleanup view
     */
    cleanupView(leafId: string): void;
    
    /**
     * Get all active views
     */
    getActiveViews(): Map<string, MarkdownView>;
    
    /**
     * Get view by leaf ID
     */
    getViewByLeafId(leafId: string): MarkdownView | null;
    
    /**
     * Check if view is active
     */
    isViewActive(leafId: string): boolean;
}

// ============================
// DOM Attachment Service Interface
// ============================

export interface IDOMAttachmentService {
    /**
     * Attach container to view
     */
    attachToView(view: MarkdownView, container: HTMLElement): boolean;
    
    /**
     * Detach container from view
     */
    detachFromView(view: MarkdownView, container: HTMLElement): boolean;
    
    /**
     * Check if container is properly attached
     */
    isAttached(view: MarkdownView, container: HTMLElement): boolean;
    
    /**
     * Cleanup orphaned containers
     */
    cleanupOrphanedContainers(view: MarkdownView): void;
    
    /**
     * Get attachment position
     */
    getAttachmentPosition(view: MarkdownView): DOMPosition | null;
}

// ============================
// View Lifecycle Handler Interface
// ============================

export interface IViewLifecycleHandler {
    /**
     * Handle mode switch
     */
    handleModeSwitch(file: TFile, view: MarkdownView): Promise<void>;
    
    /**
     * Handle focus change
     */
    handleFocusChange(view: MarkdownView, focused: boolean): void;
    
    /**
     * Handle leaf activation
     */
    handleLeafActivation(leaf: WorkspaceLeaf): void;
    
    /**
     * Handle view refresh
     */
    handleViewRefresh(view: MarkdownView): Promise<void>;
    
    /**
     * Check if view needs refresh
     */
    needsViewRefresh(view: MarkdownView, file: TFile): boolean;
}

// ============================
// View Integration Options
// ============================

export interface ViewIntegrationOptions {
    debounceDelay: number;
    maxFocusAttempts: number;
    focusRetryDelay: number;
    enableStyleMonitoring: boolean;
    enableAutoRefresh: boolean;
    enableFocusManagement: boolean;
}

// ============================
// View State
// ============================

export interface ViewState {
    leafId: string;
    filePath: string;
    isActive: boolean;
    isFocused: boolean;
    isAttached: boolean;
    mode: 'edit' | 'preview';
    lastActivity: Date;
    container: HTMLElement | null;
    hasContent: boolean;
}

// ============================

// DOM Position
// ============================

export interface DOMPosition {
    element: HTMLElement;
    position: 'before' | 'after' | 'append';
    target: string;
}

// ============================
// View Event Data
// ============================

export interface ViewEventData {
    type: 'view:initialized' | 'view:cleanup' | 'view:modeSwitch' | 'view:focusChange' | 'view:leafActivation' | 'view:refresh' | 'dom:attached' | 'dom:detached';
    data: any;
    timestamp: Date;
}

// ============================
// View Statistics
// ============================

export interface ViewStatistics {
    totalViewsInitialized: number;
    totalViewsCleanup: number;
    totalModeSwitches: number;
    totalFocusChanges: number;
    totalLeafActivations: number;
    totalViewRefreshes: number;
    totalDOMAttachments: number;
    totalDOMDetachments: number;
    totalOrphanedCleanups: number;
    lastViewInitialization?: Date;
    lastViewCleanup?: Date;
    lastModeSwitch?: Date;
    lastFocusChange?: Date;
    lastLeafActivation?: Date;
    lastViewRefresh?: Date;
    lastDOMAttachment?: Date;
    lastDOMDetachment?: Date;
    averageViewLifetime: number;
    activeViewCount: number;
}

// ============================
// View Integration Configuration
// ============================

export interface ViewIntegrationConfig {
    debounceDelay: number;
    maxFocusAttempts: number;
    focusRetryDelay: number;
    enableStyleMonitoring: boolean;
    enableAutoRefresh: boolean;
    enableFocusManagement: boolean;
    attachmentSelector: string;
    containerClass: string;
    orphanedCleanupInterval: number;
}

// ============================
// View Integration Context
// ============================

export interface ViewIntegrationContext {
    app: App;
    view: MarkdownView;
    file: TFile;
    leafId: string;
    container: HTMLElement;
    options: ViewIntegrationOptions;
}

// ============================
// View Integration Result
// ============================

export interface ViewIntegrationResult {
    success: boolean;
    error?: string;
    viewState?: ViewState;
    statistics?: Partial<ViewStatistics>;
}

// ============================
// Focus Management Options
// ============================

export interface FocusManagementOptions {
    autoFocus: boolean;
    focusDelay: number;
    maxAttempts: number;
    retryDelay: number;
    enablePeriodicCheck: boolean;
    periodicCheckInterval: number;
}

// ============================
// Style Monitoring Options
// ============================

export interface StyleMonitoringOptions {
    enabled: boolean;
    observeAttributes: string[];
    observeChildList: boolean;
    observeSubtree: boolean;
    cleanupInterval: number;
}

// ============================
// Auto Refresh Options
// ============================

export interface AutoRefreshOptions {
    enabled: boolean;
    refreshInterval: number;
    refreshOnFileChange: boolean;
    refreshOnModeSwitch: boolean;
    refreshOnFocusChange: boolean;
}

// ============================
// View Lifecycle Event
// ============================

export interface ViewLifecycleEvent {
    type: 'initialize' | 'cleanup' | 'modeSwitch' | 'focusChange' | 'leafActivation' | 'refresh';
    viewId: string;
    filePath: string;
    timestamp: Date;
    data?: any;
}

// ============================
// DOM Attachment Event
// ============================

export interface DOMAttachmentEvent {
    type: 'attach' | 'detach' | 'cleanup';
    viewId: string;
    container: HTMLElement;
    position: DOMPosition;
    timestamp: Date;
    success: boolean;
    error?: string;
}

// ============================
// View Integration Error
// ============================

export interface ViewIntegrationError {
    type: 'initialization' | 'cleanup' | 'attachment' | 'detachment' | 'modeSwitch' | 'focus' | 'refresh';
    message: string;
    viewId?: string;
    filePath?: string;
    timestamp: Date;
    stack?: string;
}

// ============================
// View Integration Status
// ============================

export interface ViewIntegrationStatus {
    isInitialized: boolean;
    activeViewCount: number;
    totalViewCount: number;
    lastActivity: Date;
    errorCount: number;
    lastError?: ViewIntegrationError;
}