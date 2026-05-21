import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.JOURNEY_URL || "https://journey-catboxys-projects.vercel.app";

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  return res.json();
}

const server = new McpServer({
  name: "journey",
  version: "1.0.0",
});

// ---- Techniques ----

server.registerTool(
  "list_techniques",
  {
    description: "List all jewelry techniques being tracked",
    inputSchema: {},
  },
  async () => {
    const data = await api("/api/techniques");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "add_technique",
  {
    description: "Add a new jewelry technique to track",
    inputSchema: {
      name: z.string().describe("Name of the technique"),
      description: z.string().optional().describe("Description of the technique"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("Difficulty level"),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional().describe("Learning status"),
    },
  },
  async ({ name, description, difficulty, status }) => {
    const data = await api("/api/techniques", {
      method: "POST",
      body: JSON.stringify({ name, description, difficulty, status }),
    });
    return { content: [{ type: "text", text: `Created technique: ${JSON.stringify(data, null, 2)}` }] };
  }
);

server.registerTool(
  "update_technique",
  {
    description: "Update an existing technique",
    inputSchema: {
      id: z.number().describe("Technique ID"),
      name: z.string().describe("Name"),
      description: z.string().optional().describe("Description"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("Difficulty level"),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional().describe("Learning status"),
    },
  },
  async ({ id, name, description, difficulty, status }) => {
    const data = await api("/api/techniques", {
      method: "PUT",
      body: JSON.stringify({ id, name, description, difficulty, status }),
    });
    return { content: [{ type: "text", text: `Updated: ${JSON.stringify(data, null, 2)}` }] };
  }
);

// ---- Books ----

server.registerTool(
  "list_books",
  {
    description: "List all jewelry books being tracked",
    inputSchema: {},
  },
  async () => {
    const data = await api("/api/books");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "add_book",
  {
    description: "Add a new book to track",
    inputSchema: {
      title: z.string().describe("Book title"),
      author: z.string().optional().describe("Author name"),
      description: z.string().optional().describe("Notes about the book"),
      status: z.enum(["want_to_read", "reading", "read"]).optional().describe("Reading status"),
    },
  },
  async ({ title, author, description, status }) => {
    const data = await api("/api/books", {
      method: "POST",
      body: JSON.stringify({ title, author, description, status }),
    });
    return { content: [{ type: "text", text: `Created book: ${JSON.stringify(data, null, 2)}` }] };
  }
);

// ---- Equipment ----

server.registerTool(
  "list_equipment",
  {
    description: "List all jewelry equipment being tracked",
    inputSchema: {},
  },
  async () => {
    const data = await api("/api/equipment");
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.registerTool(
  "add_equipment",
  {
    description: "Add new equipment to track",
    inputSchema: {
      name: z.string().describe("Equipment name"),
      description: z.string().optional().describe("Description"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Purchase priority"),
      url: z.string().optional().describe("Link to buy"),
      purchased: z.boolean().optional().default(false).describe("Whether already purchased/owned"),
    },
  },
  async ({ name, description, priority, url, purchased }) => {
    const data = await api("/api/equipment", {
      method: "POST",
      body: JSON.stringify({ name, description, priority, url, purchased }),
    });
    return { content: [{ type: "text", text: `Created equipment: ${JSON.stringify(data, null, 2)}` }] };
  }
);

// ---- Links ----

server.registerTool(
  "link_to_technique",
  {
    description: "Link a book or equipment to a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      type: z.enum(["book", "equipment"]).describe("Type of item to link"),
      targetId: z.number().describe("ID of the book or equipment to link"),
    },
  },
  async ({ techniqueId, type, targetId }) => {
    await api("/api/techniques/links", {
      method: "POST",
      body: JSON.stringify({ techniqueId, type, targetId }),
    });
    return { content: [{ type: "text", text: `Linked ${type} ${targetId} to technique ${techniqueId}` }] };
  }
);

server.registerTool(
  "get_technique_links",
  {
    description: "Get all books and equipment linked to a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
    },
  },
  async ({ techniqueId }) => {
    const data = await api(`/api/techniques/links?techniqueId=${techniqueId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- Journal Entries ----

server.registerTool(
  "add_journal_entry",
  {
    description: "Add a journal entry to a technique. Use this to log progress, notes, or observations about practicing a technique.",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      text: z.string().describe("Journal entry text"),
      bookIds: z.array(z.number()).optional().describe("IDs of books referenced in this entry"),
      equipmentIds: z.array(z.number()).optional().describe("IDs of equipment used in this entry"),
    },
  },
  async ({ techniqueId, text, bookIds, equipmentIds }) => {
    const formData = new FormData();
    formData.append("techniqueId", String(techniqueId));
    formData.append("text", text);
    if (bookIds?.length) formData.append("bookIds", JSON.stringify(bookIds));
    if (equipmentIds?.length) formData.append("equipmentIds", JSON.stringify(equipmentIds));

    const res = await fetch(`${BASE_URL}/api/techniques/entries`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return { content: [{ type: "text", text: `Created journal entry: ${JSON.stringify(data)}` }] };
  }
);

server.registerTool(
  "list_journal_entries",
  {
    description: "List all journal entries for a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
    },
  },
  async ({ techniqueId }) => {
    const data = await api(`/api/techniques/entries?techniqueId=${techniqueId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ---- Start ----

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Journey MCP server running");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
