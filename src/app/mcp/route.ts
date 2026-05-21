import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { execute } from "@/lib/db";

function createServer() {
  const server = new McpServer(
    { name: "journey", version: "1.0.0" },
    { capabilities: { logging: {} } }
  );

  // ---- Techniques ----

  server.registerTool("list_techniques", {
    description: "List all jewelry techniques being tracked",
    inputSchema: {},
  }, async () => {
    const result = await execute("SELECT * FROM techniques ORDER BY created_at DESC");
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("add_technique", {
    description: "Add a new jewelry technique to track",
    inputSchema: {
      name: z.string().describe("Name of the technique"),
      description: z.string().optional().describe("Description of the technique"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("Difficulty level"),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional().describe("Learning status"),
    },
  }, async ({ name, description, difficulty, status }) => {
    const result = await execute(
      "INSERT INTO techniques (name, description, difficulty, status) VALUES (?, ?, ?, ?)",
      [name, description || "", difficulty || "beginner", status || "want_to_learn"]
    );
    const row = await execute("SELECT * FROM techniques WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  server.registerTool("update_technique", {
    description: "Update an existing technique",
    inputSchema: {
      id: z.number().describe("Technique ID"),
      name: z.string().describe("Name"),
      description: z.string().optional().describe("Description"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional(),
    },
  }, async ({ id, name, description, difficulty, status }) => {
    await execute(
      "UPDATE techniques SET name = ?, description = ?, difficulty = ?, status = ? WHERE id = ?",
      [name, description || "", difficulty || "beginner", status || "want_to_learn", id]
    );
    const row = await execute("SELECT * FROM techniques WHERE id = ?", [id]);
    return { content: [{ type: "text", text: `Updated: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  // ---- Books ----

  server.registerTool("list_books", {
    description: "List all jewelry books being tracked",
    inputSchema: {},
  }, async () => {
    const result = await execute("SELECT * FROM books ORDER BY created_at DESC");
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("add_book", {
    description: "Add a new book to track",
    inputSchema: {
      title: z.string().describe("Book title"),
      author: z.string().optional().describe("Author name"),
      description: z.string().optional().describe("Notes about the book"),
      status: z.enum(["want_to_read", "reading", "read"]).optional().describe("Reading status"),
    },
  }, async ({ title, author, description, status }) => {
    const result = await execute(
      "INSERT INTO books (title, author, description, status) VALUES (?, ?, ?, ?)",
      [title, author || "", description || "", status || "want_to_read"]
    );
    const row = await execute("SELECT * FROM books WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  // ---- Equipment ----

  server.registerTool("list_equipment", {
    description: "List all jewelry equipment being tracked",
    inputSchema: {},
  }, async () => {
    const result = await execute("SELECT * FROM equipment ORDER BY created_at DESC");
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("add_equipment", {
    description: "Add new equipment to track",
    inputSchema: {
      name: z.string().describe("Equipment name"),
      description: z.string().optional().describe("Description"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Purchase priority"),
      url: z.string().optional().describe("Link to buy"),
    },
  }, async ({ name, description, priority, url }) => {
    const result = await execute(
      "INSERT INTO equipment (name, description, priority, purchased, url) VALUES (?, ?, ?, 0, ?)",
      [name, description || "", priority || "medium", url || ""]
    );
    const row = await execute("SELECT * FROM equipment WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  // ---- Links ----

  server.registerTool("link_to_technique", {
    description: "Link a book or equipment to a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      type: z.enum(["book", "equipment"]).describe("Type of item to link"),
      targetId: z.number().describe("ID of the book or equipment to link"),
    },
  }, async ({ techniqueId, type, targetId }) => {
    if (type === "book") {
      await execute("INSERT OR IGNORE INTO technique_books (technique_id, book_id) VALUES (?, ?)", [techniqueId, targetId]);
    } else {
      await execute("INSERT OR IGNORE INTO technique_equipment (technique_id, equipment_id) VALUES (?, ?)", [techniqueId, targetId]);
    }
    return { content: [{ type: "text", text: `Linked ${type} ${targetId} to technique ${techniqueId}` }] };
  });

  server.registerTool("get_technique_links", {
    description: "Get all books and equipment linked to a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
    },
  }, async ({ techniqueId }) => {
    const books = await execute(
      `SELECT b.* FROM books b JOIN technique_books tb ON tb.book_id = b.id WHERE tb.technique_id = ?`,
      [techniqueId]
    );
    const equipment = await execute(
      `SELECT e.* FROM equipment e JOIN technique_equipment te ON te.equipment_id = e.id WHERE te.technique_id = ?`,
      [techniqueId]
    );
    return { content: [{ type: "text", text: JSON.stringify({ books: books.rows, equipment: equipment.rows }, null, 2) }] };
  });

  // ---- Journal Entries ----

  server.registerTool("add_journal_entry", {
    description: "Add a journal entry to a technique. Use this to log progress, notes, or observations.",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      text: z.string().describe("Journal entry text"),
      bookIds: z.array(z.number()).optional().describe("IDs of books referenced"),
      equipmentIds: z.array(z.number()).optional().describe("IDs of equipment used"),
    },
  }, async ({ techniqueId, text, bookIds, equipmentIds }) => {
    const result = await execute(
      "INSERT INTO technique_entries (technique_id, text) VALUES (?, ?)",
      [techniqueId, text]
    );
    const entryId = result.lastInsertRowid!;
    if (bookIds?.length) {
      for (const id of bookIds) {
        await execute("INSERT OR IGNORE INTO entry_books (entry_id, book_id) VALUES (?, ?)", [entryId, id]);
      }
    }
    if (equipmentIds?.length) {
      for (const id of equipmentIds) {
        await execute("INSERT OR IGNORE INTO entry_equipment (entry_id, equipment_id) VALUES (?, ?)", [entryId, id]);
      }
    }
    return { content: [{ type: "text", text: `Created journal entry #${entryId}` }] };
  });

  server.registerTool("list_journal_entries", {
    description: "List all journal entries for a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
    },
  }, async ({ techniqueId }) => {
    const entries = await execute(
      "SELECT * FROM technique_entries WHERE technique_id = ? ORDER BY created_at DESC",
      [techniqueId]
    );
    return { content: [{ type: "text", text: JSON.stringify(entries.rows, null, 2) }] };
  });

  return server;
}

export async function POST(request: Request) {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  await transport.close();
  await server.close();
  return response;
}

export async function GET() {
  return Response.json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST." },
    id: null,
  }, { status: 405 });
}

export async function DELETE() {
  return Response.json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Session management not supported in stateless mode." },
    id: null,
  }, { status: 405 });
}
