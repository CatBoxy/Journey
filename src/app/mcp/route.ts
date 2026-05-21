import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { execute, buildPartialUpdate } from "@/lib/db";

function createServer() {
  const server = new McpServer(
    { name: "journey", version: "2.0.0" },
    { capabilities: { logging: {} } }
  );

  // ---- Techniques ----

  server.registerTool("list_techniques", {
    description: "List all jewelry techniques. Optionally filter by category.",
    inputSchema: {
      category: z.string().optional().describe("Filter by category (exact match)"),
    },
  }, async ({ category }) => {
    let sql = "SELECT * FROM techniques";
    const args: unknown[] = [];
    if (category) { sql += " WHERE category = ?"; args.push(category); }
    sql += " ORDER BY created_at DESC";
    const result = await execute(sql, args);
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("add_technique", {
    description: "Add a new jewelry technique to track",
    inputSchema: {
      name: z.string().describe("Name of the technique"),
      description: z.string().optional().describe("Description"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().describe("Difficulty level"),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional().describe("Learning status"),
      category: z.string().optional().describe("Free-form category (e.g. 'soldering', 'finishing', 'stone setting')"),
    },
  }, async ({ name, description, difficulty, status, category }) => {
    const result = await execute(
      "INSERT INTO techniques (name, description, difficulty, status, category) VALUES (?, ?, ?, ?, ?)",
      [name, description || "", difficulty || "beginner", status || "want_to_learn", category || ""]
    );
    const row = await execute("SELECT * FROM techniques WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  server.registerTool("update_technique", {
    description: "Update an existing technique. Only fields you include will be changed — omitted fields are left untouched.",
    inputSchema: {
      id: z.number().describe("Technique ID"),
      name: z.string().optional().describe("Name"),
      description: z.string().optional().describe("Description"),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      status: z.enum(["want_to_learn", "learning", "mastered"]).optional(),
      category: z.string().optional().describe("Free-form category"),
    },
  }, async ({ id, name, description, difficulty, status, category }) => {
    const update = buildPartialUpdate("techniques", id, { name, description, difficulty, status, category });
    if (update) await execute(update.sql, update.args);
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
      url: z.string().optional().describe("Purchase or reference link"),
    },
  }, async ({ title, author, description, status, url }) => {
    const result = await execute(
      "INSERT INTO books (title, author, description, status, url) VALUES (?, ?, ?, ?, ?)",
      [title, author || "", description || "", status || "want_to_read", url || ""]
    );
    const row = await execute("SELECT * FROM books WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  server.registerTool("update_book", {
    description: "Update an existing book. Only fields you include will be changed — omitted fields are left untouched.",
    inputSchema: {
      id: z.number().describe("Book ID"),
      title: z.string().optional().describe("Book title"),
      author: z.string().optional().describe("Author name"),
      description: z.string().optional().describe("Notes"),
      status: z.enum(["want_to_read", "reading", "read"]).optional(),
      url: z.string().optional().describe("Purchase or reference link"),
    },
  }, async ({ id, title, author, description, status, url }) => {
    const update = buildPartialUpdate("books", id, { title, author, description, status, url });
    if (update) await execute(update.sql, update.args);
    const row = await execute("SELECT * FROM books WHERE id = ?", [id]);
    return { content: [{ type: "text", text: `Updated: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  // ---- Equipment ----

  server.registerTool("list_equipment", {
    description: "List all jewelry equipment being tracked. Includes price (ARS) and purchased status.",
    inputSchema: {},
  }, async () => {
    const result = await execute("SELECT * FROM equipment ORDER BY created_at DESC");
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("add_equipment", {
    description: "Add new equipment to track. Price is in ARS.",
    inputSchema: {
      name: z.string().describe("Equipment name"),
      description: z.string().optional().describe("Description"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Purchase priority"),
      url: z.string().optional().describe("Link to buy"),
      price: z.number().optional().describe("Price in ARS (nullable)"),
      purchased: z.boolean().optional().default(false).describe("Whether already purchased/owned"),
    },
  }, async ({ name, description, priority, url, price, purchased }) => {
    const result = await execute(
      "INSERT INTO equipment (name, description, priority, purchased, url, price) VALUES (?, ?, ?, ?, ?, ?)",
      [name, description || "", priority || "medium", purchased ? 1 : 0, url || "", price ?? null]
    );
    const row = await execute("SELECT * FROM equipment WHERE id = ?", [result.lastInsertRowid!]);
    return { content: [{ type: "text", text: `Created: ${JSON.stringify(row.rows[0], null, 2)}` }] };
  });

  server.registerTool("update_equipment", {
    description: "Update existing equipment. Only fields you include will be changed — omitted fields are left untouched. Price is in ARS.",
    inputSchema: {
      id: z.number().describe("Equipment ID"),
      name: z.string().optional().describe("Equipment name"),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      url: z.string().optional().describe("Link to buy"),
      price: z.number().optional().describe("Price in ARS"),
      purchased: z.boolean().optional().describe("Whether the equipment has been purchased"),
    },
  }, async ({ id, name, description, priority, url, price, purchased }) => {
    const update = buildPartialUpdate("equipment", id, {
      name,
      description,
      priority,
      url,
      price: price !== undefined ? (price ?? null) : undefined,
      purchased: purchased !== undefined ? (purchased ? 1 : 0) : undefined,
    });
    if (update) await execute(update.sql, update.args);
    const row = await execute("SELECT * FROM equipment WHERE id = ?", [id]);
    return { content: [{ type: "text", text: `Updated: ${JSON.stringify(row.rows[0], null, 2)}` }] };
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

  server.registerTool("unlink_from_technique", {
    description: "Remove a book or equipment link from a technique",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      type: z.enum(["book", "equipment"]).describe("Type of item to unlink"),
      targetId: z.number().describe("ID of the book or equipment to unlink"),
    },
  }, async ({ techniqueId, type, targetId }) => {
    if (type === "book") {
      await execute("DELETE FROM technique_books WHERE technique_id = ? AND book_id = ?", [techniqueId, targetId]);
    } else {
      await execute("DELETE FROM technique_equipment WHERE technique_id = ? AND equipment_id = ?", [techniqueId, targetId]);
    }
    return { content: [{ type: "text", text: `Unlinked ${type} ${targetId} from technique ${techniqueId}` }] };
  });

  server.registerTool("get_technique_links", {
    description: "Get all books and equipment linked to a technique, with cost rollup (spent vs to_spend, ARS)",
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
    const eqRows = equipment.rows as Array<{ purchased: number; price: number | null }>;
    const spent = eqRows.filter((e) => e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);
    const toSpend = eqRows.filter((e) => !e.purchased).reduce((sum, e) => sum + (e.price || 0), 0);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          books: books.rows,
          equipment: equipment.rows,
          cost: { spent, to_spend: toSpend, total: spent + toSpend },
        }, null, 2),
      }],
    };
  });

  // ---- Journal Entries ----

  server.registerTool("add_journal_entry", {
    description: "Add a journal entry to a technique. Log progress, notes, observations, and optionally track time spent.",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
      text: z.string().describe("Journal entry text"),
      minutesSpent: z.number().optional().describe("Minutes spent practicing (nullable)"),
      bookIds: z.array(z.number()).optional().describe("IDs of books referenced"),
      equipmentIds: z.array(z.number()).optional().describe("IDs of equipment used"),
    },
  }, async ({ techniqueId, text, minutesSpent, bookIds, equipmentIds }) => {
    const result = await execute(
      "INSERT INTO technique_entries (technique_id, text, minutes_spent) VALUES (?, ?, ?)",
      [techniqueId, text, minutesSpent ?? null]
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
    description: "List all journal entries for a technique, with images, linked books, and equipment",
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

  server.registerTool("list_journal_entries_by_item", {
    description: "List all journal entries that reference a specific book or piece of equipment, with parent technique name",
    inputSchema: {
      type: z.enum(["book", "equipment"]).describe("Type of item"),
      id: z.number().describe("ID of the book or equipment"),
    },
  }, async ({ type, id }) => {
    const joinTable = type === "book" ? "entry_books" : "entry_equipment";
    const fkColumn = type === "book" ? "book_id" : "equipment_id";
    const result = await execute(
      `SELECT te.*, t.name as technique_name
       FROM technique_entries te
       JOIN ${joinTable} j ON j.entry_id = te.id
       JOIN techniques t ON t.id = te.technique_id
       WHERE j.${fkColumn} = ?
       ORDER BY te.created_at DESC`,
      [id]
    );
    return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
  });

  server.registerTool("get_technique_time_stats", {
    description: "Get time tracking stats for a technique. Returns total_minutes, total_entry_count (all entries), tracked_entry_count (entries with minutes_spent set), date range, and monthly breakdown.",
    inputSchema: {
      techniqueId: z.number().describe("Technique ID"),
    },
  }, async ({ techniqueId }) => {
    const result = await execute(
      `SELECT
         COALESCE(SUM(minutes_spent), 0) as total_minutes,
         COUNT(*) as total_entry_count,
         COUNT(minutes_spent) as tracked_entry_count,
         MIN(created_at) as first_entry,
         MAX(created_at) as last_entry
       FROM technique_entries WHERE technique_id = ?`,
      [techniqueId]
    );
    const monthly = await execute(
      `SELECT strftime('%Y-%m', created_at) as month,
              COALESCE(SUM(minutes_spent), 0) as minutes,
              COUNT(*) as entries
       FROM technique_entries WHERE technique_id = ?
       GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC`,
      [techniqueId]
    );
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ ...result.rows[0], monthly: monthly.rows }, null, 2),
      }],
    };
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
