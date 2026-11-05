import { supabase } from './supabase';


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

/**
 * Automatically inspects the user query for mentions of specific developers, posts, projects, or feed activities
 * and queries Supabase in real-time to provide factual grounding for the LLM.
 * Returns: { contextText: string, sources: Array<{ id, title, type, score }> }
 */
export async function fetchRealtimeConnectraContext(query) {
  if (!query) return { contextText: '', sources: [] };
  const lower = query.toLowerCase();
  const contextBlocks = [];
  const sources = [];

  try {
    // 1. Detect if the query is asking about a specific person or username
    // Examples: "by sarah", "@sarah", "what did sarah post", "sarah's last post", "posts by alex"
    let targetUsername = null;
    const atMatch = query.match(/@([a-zA-Z0-9_]+)/);
    if (atMatch) {
      targetUsername = atMatch[1];
    } else {
      const byMatch = query.match(/(?:by|from|of|for|about)\s+([a-zA-Z0-9_]+)/i);
      const apostropheMatch = query.match(/([a-zA-Z0-9_]+)'s\s+(?:post|last\s+post|latest\s+post|code|project|update)/i);
      const stopNames = ['the', 'a', 'an', 'me', 'my', 'him', 'her', 'them', 'us', 'you', 'this', 'that', 'someone', 'anyone', 'all', 'specific', 'person', 'user'];
      
      if (apostropheMatch && !stopNames.includes(apostropheMatch[1].toLowerCase())) {
        targetUsername = apostropheMatch[1];
      } else if (byMatch && !stopNames.includes(byMatch[1].toLowerCase())) {
        targetUsername = byMatch[1];
      }
    }

    if (targetUsername) {
      // Look up target profile in profiles table
      const { data: matchedProfiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, bio, tech_stack, created_at')
        .or(`username.ilike.%${targetUsername}%,full_name.ilike.%${targetUsername}%`)
        .limit(3);

      if (matchedProfiles && matchedProfiles.length > 0) {
        for (const p of matchedProfiles) {
          // Fetch their latest posts in reverse-chronological order
          const { data: userPosts } = await supabase
            .from('posts')
            .select('id, content, code_snippet, code_language, created_at, likes_count, comments_count')
            .eq('user_id', p.id)
            .order('created_at', { ascending: false })
            .limit(5);

          sources.push({
            id: `profile-${p.id}`,
            title: `Live Database: @${p.username}'s Profile & Latest Posts`,
            type: 'database',
            score: 0.98,
          });

          const postSummaries = userPosts && userPosts.length > 0
            ? userPosts.map((post, idx) => `
[Post #${idx + 1} - ID: ${post.id}]
- Published: ${new Date(post.created_at).toLocaleString()} (${post.created_at})
- Text Content: "${post.content || '(No text content)'}"
${post.code_snippet ? `- Code Snippet (${post.code_language || 'code'}):\n\`\`\`${post.code_language || ''}\n${post.code_snippet}\n\`\`\`` : ''}
- Likes: ${post.likes_count || 0} | Comments: ${post.comments_count || 0}
`).join('\n')
            : `(No posts published yet by @${p.username}.)`;

          contextBlocks.push(`=== VERIFIED DATABASE RECORD: @${p.username} ===
Developer: @${p.username} (Display Name: ${p.full_name || p.username})
Bio: ${p.bio || 'None provided'}
Tech Stack: ${p.tech_stack || 'None specified'}
Account Created: ${new Date(p.created_at).toLocaleDateString()}

Posts by @${p.username} (Ordered strictly newest first):
${postSummaries}
=== END RECORD FOR @${p.username} ===`);
        }
      }
    }

    // 2. If query asks about general feed posts, latest posts, or what's new
    const isAskingAboutFeed =
      lower.includes('post') ||
      lower.includes('feed') ||
      lower.includes('latest') ||
      lower.includes('recent') ||
      lower.includes('what did') ||
      lower.includes('shared');

    if (isAskingAboutFeed && contextBlocks.length === 0) {
      const { data: recentFeedPosts } = await supabase
        .from('posts')
        .select(`
          id, content, code_snippet, code_language, created_at, likes_count, comments_count,
          profiles(username, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(8);

      if (recentFeedPosts && recentFeedPosts.length > 0) {
        sources.push({
          id: 'live-feed-posts',
          title: 'Live Connectra Feed Database (Latest Posts)',
          type: 'database',
          score: 0.95,
        });

        contextBlocks.push(`=== VERIFIED DATABASE RECORD: RECENT FEED POSTS (Newest First) ===
${recentFeedPosts.map((post, idx) => `
[Post #${idx + 1}] By: @${post.profiles?.username || 'developer'} (${post.profiles?.full_name || ''})
Published: ${new Date(post.created_at).toLocaleString()}
Content: "${post.content || ''}"
${post.code_snippet ? `Code (${post.code_language || 'code'}):\n\`\`\`${post.code_language || ''}\n${post.code_snippet}\n\`\`\`` : ''}
`).join('\n')}
=== END RECENT POSTS RECORD ===`);
      }
    }

    // 3. If query mentions projects, collaborations, repositories
    const isAskingAboutProjects =
      lower.includes('project') ||
      lower.includes('collab') ||
      lower.includes('team') ||
      lower.includes('kanban');

    if (isAskingAboutProjects) {
      const { data: recentProjects } = await supabase
        .from('projects')
        .select('id, title, description, tech_stack, status, created_at, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentProjects && recentProjects.length > 0) {
        sources.push({
          id: 'live-projects',
          title: 'Live Connectra Projects Database',
          type: 'database',
          score: 0.92,
        });

        contextBlocks.push(`=== VERIFIED DATABASE RECORD: CONNECTRA ACTIVE PROJECTS ===
${recentProjects.map((proj, idx) => `
[Project #${idx + 1}] "${proj.title}" (Status: ${proj.status})
Lead: @${proj.profiles?.username || 'member'} | Tech Stack: ${proj.tech_stack || 'Web'}
Description: ${proj.description || 'No description provided'}
Created: ${new Date(proj.created_at).toLocaleDateString()}
`).join('\n')}
=== END PROJECTS RECORD ===`);
      }
    }

    // 4. If query asks about active developers or members
    const isAskingAboutDevelopers =
      lower.includes('developer') ||
      lower.includes('who is') ||
      lower.includes('who are') ||
      lower.includes('members') ||
      lower.includes('users');

    if (isAskingAboutDevelopers && contextBlocks.length === 0) {
      const { data: topDevs } = await supabase
        .from('profiles')
        .select('username, full_name, bio, tech_stack, xp, level')
        .order('xp', { ascending: false })
        .limit(6);

      if (topDevs && topDevs.length > 0) {
        sources.push({
          id: 'live-developers',
          title: 'Live Connectra Developer Directory',
          type: 'database',
          score: 0.90,
        });

        contextBlocks.push(`=== VERIFIED DATABASE RECORD: TOP DEVELOPERS ===
${topDevs.map((d, idx) => `${idx + 1}. @${d.username} (${d.full_name || ''}) - Lv.${d.level || 1} (${d.xp || 0} XP) | Stack: ${d.tech_stack || 'N/A'} | Bio: ${d.bio || 'None'}`).join('\n')}
=== END DEVELOPERS RECORD ===`);
      }
    }
  } catch (err) {
    console.warn('Realtime Connectra DB context error:', err);
  }

  const contextText = contextBlocks.length > 0
    ? `\n\n=== REAL-TIME CONNECTRA LIVE DATABASE (GROUND TRUTH) ===\nUse this real-time database query result to answer the user's question directly with exact dates, usernames, and content:\n\n${contextBlocks.join('\n\n')}\n=== END REAL-TIME DATABASE ===\n`
    : '';

  return { contextText, sources };
}
