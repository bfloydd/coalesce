```mermaid
graph TD
    A[Plugin Orchestrator] --> B[ViewIntegration Slice]
    A --> C[Backlinks Slice]
    A --> D[BacklinkBlocks Slice]
    A --> E[BacklinksHeader Slice]
    A --> F[Settings Slice]
    A --> G[Navigation Slice]
    A --> H[NoteEditing Slice]
    A --> I[SharedUtilities Slice]
    A --> J[SharedContracts Slice]

    B --> K[DOM Attachment]
    B --> L[View Lifecycle]
    B --> M[Mode Switching]

    C --> N[Backlink Discovery]
    C --> O[Link Resolution]
    C --> P[Cache Management]

    D --> Q[Block Extraction]
    D --> R[Block Display]
    D --> S[Strategy Management]

    E --> T[Header UI]
    E --> U[Filter Controls]
    E --> V[Settings Controls]

    F --> W[Settings Storage]
    F --> X[Theme Management]
    F --> Y[Settings UI]

    G --> Z[File Opening]
    G --> AA[Link Handling]
    G --> AB[Navigation Events]

    H --> AC[File Modifications]
    H --> AD[Heading Management]
    H --> AE[Content Editing]

    I --> AF[Logging]
    I --> AG[Daily Notes]
    I --> AH[Shared Utilities]

    J --> AI[Type Definitions]
    J --> AJ[Interfaces]
    J --> AK[Plugin Types]

    B -.->|events| C
    C -.->|data| D
    D -.->|blocks| E
    E -.->|actions| G
    E -.->|content| H
    F -.->|config| B,C,D,E,H
    I -.->|utils| B,C,D,E,F,G,H,J
    J -.->|types| B,C,D,E,F,G,H,I