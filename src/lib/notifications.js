import { supabase } from './supabase';

/**
 * Creates an in-app notification for a user.
 * Gracefully ignores any errors or constraint conflicts so it doesn't break primary flows.
 *
 * @param {Object} params
 * @param {string} params.userId - Recipient of the notification
 * @param {string} params.actorId - User who performed the action
 * @param {('follow'|'connection_request'|'connection_accepted'|'like'|'comment')} params.type
 * @param {string} [params.entityId] - Target ID (e.g. post_id, connection_id)
 */
export async function createNotification({ userId, actorId, type, entityId = null }) {
  if (!userId || !actorId || userId === actorId) return;

  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      actor_id: actorId,
      type,
      entity_id: entityId,
      is_read: false,
    });

    if (error) {
      console.warn('createNotification notice:', error.message);
    }
  } catch (err) {
    console.warn('createNotification exception:', err);
  }
}
