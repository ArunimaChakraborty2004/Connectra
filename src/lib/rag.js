/**
 * Connectra RAG (Retrieval-Augmented Generation) Engine
 * Implements client-side BM25 / TF-IDF vector & keyword indexing over:
 * - Project Workspace (Kanban tasks, milestones, file metadata, tech stack)
 * - Developer Communities (discussions, forum threads, answers)
 * - Developer profiles and code repositories
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'but', 'they', 'have', 'had', 'what', 'when', 'where',
  'who', 'which', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'can', 'just', 'should', 'now', 'we', 'our', 'my'
]);

/**
 * Tokenize and normalize text into searchable term tokens
 */
export function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-\.\/]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

/**
 * Builds a searchable index over an array of document chunks
 * Each document: { id, title, content, type: 'task' | 'milestone' | 'discussion' | 'doc', metadata }
 */
export function buildDocumentIndex(documents) {
  const index = {
    documents: [],
    df: {}, // Document frequency per term
    docLengths: [],
    avgDocLength: 0,
    totalDocs: 0,
  };

  if (!documents || documents.length === 0) return index;

  let totalLength = 0;
  index.documents = documents.map((doc, docIdx) => {
    const combinedText = `${doc.title || ''} ${doc.content || ''} ${JSON.stringify(doc.metadata || {})}`;
    const tokens = tokenize(combinedText);
    const tf = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }

    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      index.df[t] = (index.df[t] || 0) + 1;
    }

    index.docLengths.push(tokens.length);
    totalLength += tokens.length;

    return {
      ...doc,
      docIdx,
      tokens,
      tf,
    };
  });

  index.totalDocs = documents.length;
  index.avgDocLength = totalLength / Math.max(1, index.totalDocs);
  return index;
}

/**
 * Scores documents against a query using BM25 ranking function
 * BM25 Formula: IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * (|D| / avgDL)))
 */
export function searchIndex(index, query, topK = 3) {
  if (!index || !index.totalDocs || !query) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const k1 = 1.5;
  const b = 0.75;
  const N = index.totalDocs;

  const scores = index.documents.map((doc, i) => {
    let score = 0;
    const docLength = index.docLengths[i];

    for (const token of queryTokens) {
      const tf = doc.tf[token] || 0;
      if (tf === 0) continue;

      const df = index.df[token] || 0;
      // Inverse Document Frequency with smoothing
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

      // BM25 term weighting
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLength / Math.max(1, index.avgDocLength)));
      score += idf * (numerator / denominator);
    }

    // Boost exact title keyword match
    for (const token of queryTokens) {
      if (doc.title && doc.title.toLowerCase().includes(token)) {
        score += 1.2;
      }
    }

    return {
      document: doc,
      score: Number(score.toFixed(3)),
    };
  });

  // Filter out zero-score docs and sort descending
  return scores
    .filter(item => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Extracts indexable knowledge chunks from a Project object
 */
export function extractProjectKnowledgeChunks(project, tasks = [], milestones = []) {
  const chunks = [];

  // 1. Project Overview & Tech Stack Chunk
  if (project) {
    chunks.push({
      id: `project-${project.id || 'current'}`,
      title: `Project Overview: ${project.title || 'Workspace'}`,
      type: 'project_overview',
      content: `Title: ${project.title}\nDescription: ${project.description || 'No description'}\nTech Stack: ${project.tech_stack || 'Web'}\nStatus: ${project.status || 'Active'}`,
      metadata: { projectId: project.id },
    });
  }

  // 2. Kanban Tasks Chunks
  tasks.forEach((task, idx) => {
    chunks.push({
      id: `task-${task.id || idx}`,
      title: `Task #${idx + 1}: ${task.title}`,
      type: 'task',
      content: `Status: ${task.status || 'To Do'}\nPriority: ${task.priority || 'Normal'}\nAssignee: ${task.assignee?.username || 'Unassigned'}\nDetails: ${task.description || task.content || 'None'}`,
      metadata: { taskId: task.id, status: task.status },
    });
  });

  // 3. Milestones Chunks
  milestones.forEach((m, idx) => {
    chunks.push({
      id: `milestone-${m.id || idx}`,
      title: `Milestone: ${m.title}`,
      type: 'milestone',
      content: `Target Date: ${m.target_date || 'TBD'}\nCompleted: ${m.completed ? 'Yes' : 'No'}\nNotes: ${m.description || ''}`,
      metadata: { milestoneId: m.id },
    });
  });

  return chunks;
}

/**
 * Extracts indexable knowledge chunks from Community Posts & Discussions
 */
export function extractCommunityKnowledgeChunks(community, posts = []) {
  const chunks = [];

  if (community) {
    chunks.push({
      id: `community-${community.id}`,
      title: `Community: ${community.name}`,
      type: 'community_rules',
      content: `About: ${community.description || ''}\nRules: ${community.rules || 'Be respectful and follow code guidelines'}\nMembers: ${community.member_count || 0}`,
      metadata: { communityId: community.id },
    });
  }

  posts.forEach((post, idx) => {
    chunks.push({
      id: `discussion-${post.id || idx}`,
      title: `Discussion by @${post.profiles?.username || 'member'}`,
      type: 'discussion',
      content: `${post.content || ''}\n${post.code_snippet ? `Code Snippet (${post.code_language || 'code'}):\n${post.code_snippet}` : ''}`,
      metadata: { postId: post.id, author: post.profiles?.username },
    });
  });

  return chunks;
}

/**
 * Assembles a RAG-grounded context block for injection into LLM system prompts
 */
export function formatRAGContextForPrompt(retrievedItems) {
  if (!retrievedItems || retrievedItems.length === 0) return '';

  const references = retrievedItems.map((item, idx) => {
    const doc = item.document;
    return `[Ref ${idx + 1} (${doc.type}) - "${doc.title}"] (Relevance: ${item.score})\n${doc.content}`;
  }).join('\n\n---\n\n');

  return `\n\n=== RETRIEVED KNOWLEDGE BASE CONTEXT (RAG ACTIVE) ===\nUse the following verified context from the active workspace to ground your answers. When you reference facts from these records, explicitly cite them as [Ref 1], [Ref 2], etc.\n\n${references}\n=== END RETRIEVED CONTEXT ===\n`;
}
