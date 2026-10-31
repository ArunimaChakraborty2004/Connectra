import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  Search,
  Circle,
  ArrowLeft,
  X,
  Users,
  Plus,
  Shield,
  Megaphone,
  Trash2,
  UserCheck,
  UserPlus,
  Settings,
  MoreVertical,
  Check,
  Crown,
  Pin,
  Lock,
  Globe,
  Share2,
  Paperclip,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Copy,
  LogOut,
  Bell,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../lib/toast';
import Loader from '../components/ui/Loader';
import { createNotification } from '../lib/notifications';

export default function ChatPage({ session }) {
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('groups'); // 'direct' | 'groups'
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnnouncementMsg, setIsAnnouncementMsg] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);

  // Attachment states (Teams style)
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);

  // Group modal & management states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Group members & admin controls modal
  const [showGroupAdminModal, setShowGroupAdminModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupAdminRole, setGroupAdminRole] = useState(false); // is current user admin of selected group
  const [loadingGroupMembers, setLoadingGroupMembers] = useState(false);
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const myId = session?.user?.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Initialize from URL parameters if provided (e.g. /chat?user=UUID or /chat?group=UUID)
  useEffect(() => {
    const targetUserId = searchParams.get('user');
    const targetGroupId = searchParams.get('group');

    if (targetUserId) {
      setActiveTab('direct');
      setSelectedGroup(null);
      // Fetch user profile if not in conversations
      supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('id', targetUserId)
        .single()
        .then(({ data }) => {
          if (data) startChat(data);
        });
    } else if (targetGroupId) {
      setActiveTab('groups');
      setSelectedUser(null);
      supabase
        .from('chat_groups')
        .select('*')
        .eq('id', targetGroupId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedGroup(data);
        });
    }
  }, [searchParams]);

  useEffect(() => {
    loadConversations();
    loadGroups();
  }, [myId]);

  // Load Direct Messages
  useEffect(() => {
    if (!selectedUser || selectedGroup) return;
    loadDirectMessages(selectedUser.id);

    // Channel identifier sorted so both users share identical channel topic or unique listener
    const channelName = `chat-direct-${[myId, selectedUser.id].sort().join('-')}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        payload => {
          const newMsg = payload.new;
          // Check if this message belongs to the active conversation between myId and selectedUser.id
          const isRelevant = 
            (newMsg.sender_id === selectedUser.id && newMsg.receiver_id === myId) ||
            (newMsg.sender_id === myId && newMsg.receiver_id === selectedUser.id);

          if (isRelevant) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedUser?.id, selectedGroup]);

  // Load Group Messages (Fixed Dependency so no flickering / infinite re-render loop occurs)
  useEffect(() => {
    if (!selectedGroup?.id) return;
    loadGroupMessages(selectedGroup.id);
    loadGroupDetails(selectedGroup.id);

    const channel = supabase
      .channel(`chat-group-${selectedGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_group_messages',
          filter: `group_id=eq.${selectedGroup.id}`,
        },
        payload => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedGroup?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle startChat custom event from other pages
  useEffect(() => {
    const handleStartChat = (e) => {
      const { userId, username } = e.detail || {};
      if (userId && username) {
        setActiveTab('direct');
        setSelectedGroup(null);
        startChat({ id: userId, username });
      }
    };
    document.addEventListener('startChat', handleStartChat);
    return () => document.removeEventListener('startChat', handleStartChat);
  }, []);

  const loadConversations = async () => {
    setLoadingConvos(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select(`
          id, sender_id, receiver_id, content, created_at,
          sender:profiles!messages_sender_id_fkey(id, username, avatar_url),
          receiver:profiles!messages_receiver_id_fkey(id, username, avatar_url)
        `)
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false });

      if (!data) return;

      const seen = new Set();
      const convos = [];
      for (const msg of data) {
        const otherId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id;
        if (!seen.has(otherId)) {
          seen.add(otherId);
          const otherProfile = msg.sender_id === myId ? msg.receiver : msg.sender;
          if (otherProfile) convos.push({ ...otherProfile, lastMessage: msg.content });
        }
      }
      setConversations(convos);
    } catch (err) {
      console.error('loadConversations error:', err);
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadGroups = async () => {
    try {
      // Fetch public groups or groups where current user is member
      const { data: memberGroups } = await supabase
        .from('chat_group_members')
        .select('group_id, role, chat_groups(*)')
        .eq('user_id', myId);

      const formatted = (memberGroups || [])
        .map(mg => (mg.chat_groups ? { ...mg.chat_groups, myRole: mg.role } : null))
        .filter(Boolean);

      setGroups(formatted);

      // Auto-select first group if none selected and activeTab is groups
      if (!selectedGroup && !selectedUser && activeTab === 'groups' && formatted.length > 0) {
        setSelectedGroup(formatted[0]);
      }
    } catch (err) {
      console.warn('loadGroups error:', err);
    }
  };

  const loadDirectMessages = async (otherUserId) => {
    setLoadingMessages(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${myId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${myId})`
        )
        .order('created_at', { ascending: true });
      setMessages(data || []);
    } catch (err) {
      console.warn('loadDirectMessages error:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadGroupMessages = async (groupId) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_group_messages')
        .select(`
          id, group_id, sender_id, content, is_announcement, attachment_url, attachment_name, attachment_type, created_at,
          sender:profiles!chat_group_messages_sender_id_fkey(username, avatar_url)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      if (err?.message?.includes('attachment_') || err?.message?.includes('column')) {
        const { data } = await supabase
          .from('chat_group_messages')
          .select(`
            id, group_id, sender_id, content, is_announcement, created_at,
            sender:profiles!chat_group_messages_sender_id_fkey(username, avatar_url)
          `)
          .eq('group_id', groupId)
          .order('created_at', { ascending: true });
        setMessages(data || []);
      } else {
        console.warn('loadGroupMessages error:', err);
      }
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadGroupDetails = async (groupId) => {
    setLoadingGroupMembers(true);
    try {
      const { data: grp } = await supabase
        .from('chat_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (grp) {
        setNewAnnouncementText(grp.announcement || '');
      }

      const { data: mems } = await supabase
        .from('chat_group_members')
        .select('id, user_id, role, joined_at, profiles(username, avatar_url, bio)')
        .eq('group_id', groupId);

      setGroupMembers(mems || []);

      const me = mems?.find(m => m.user_id === myId);
      const isCreator = grp?.creator_id === myId;
      setGroupAdminRole(isCreator || me?.role === 'admin');
    } catch (err) {
      console.warn('loadGroupDetails error:', err);
    } finally {
      setLoadingGroupMembers(false);
    }
  };

  // Search users for Direct Chat
  const handleUserSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', myId)
      .limit(6);
    setSearchResults(data || []);
  };

  const startChat = (user) => {
    setSelectedGroup(null);
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
    if (!conversations.some(c => c.id === user.id)) {
      setConversations(prev => [user, ...prev]);
    }
  };

  // Create New Chat Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);

    try {
      const inviteCode = Math.random().toString(36).substring(2, 9);
      const { data: groupData, error: grpError } = await supabase
        .from('chat_groups')
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          creator_id: myId,
          is_private: newGroupIsPrivate,
          invite_code: inviteCode,
          announcement: 'Welcome to our collective! 🚀 Keep discussions constructive and secure.',
          announcement_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (grpError) {
        if (grpError.code === '42P01') {
          throw new Error('Please run database_updates.sql in your Supabase SQL Editor first!');
        }
        throw grpError;
      }

      await supabase
        .from('chat_group_members')
        .insert({
          group_id: groupData.id,
          user_id: myId,
          role: 'admin',
        });

      await supabase.from('chat_group_messages').insert({
        group_id: groupData.id,
        sender_id: myId,
        content: `🎉 Group "${newGroupName}" was created by admin. Welcome everyone!`,
        is_announcement: true,
      });

      toast.success('Group created successfully! 🚀');
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
      setSelectedUser(null);
      setSelectedGroup({ ...groupData, myRole: 'admin' });
      setActiveTab('groups');
    } catch (err) {
      toast.error(err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Handle Attachment Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds 15MB limit');
      return;
    }

    setAttachmentFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setAttachmentPreview(ev.target?.result);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Send Message (Direct or Group with optional attachment)
  const sendMessage = async () => {
    if ((!newMessage.trim() && !attachmentFile) || sending) return;
    const text = newMessage.trim();
    setSending(true);

    try {
      let attachmentUrl = null;
      let attachmentName = null;
      let attachmentType = null;

      if (attachmentFile) {
        setUploadingAttachment(true);
        const ext = attachmentFile.name.split('.').pop();
        const fileName = `${myId}-${Date.now()}.${ext}`;
        const filePath = `chat_attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('post_images')
          .upload(filePath, attachmentFile);

        if (!uploadError) {
          const { data: pubData } = supabase.storage
            .from('post_images')
            .getPublicUrl(filePath);
          attachmentUrl = pubData.publicUrl;
          attachmentName = attachmentFile.name;
          attachmentType = attachmentFile.type.startsWith('image/') ? 'image' : 'file';
        } else {
          // Graceful fallback URL
          attachmentUrl = attachmentPreview || 'https://via.placeholder.com/300?text=Attachment';
          attachmentName = attachmentFile.name;
          attachmentType = 'file';
        }
      }

      if (selectedGroup) {
        let sentData = null;
        const fullPayload = {
          group_id: selectedGroup.id,
          sender_id: myId,
          content: text || (attachmentName ? `Shared attachment: ${attachmentName}` : ''),
          is_announcement: Boolean(isAnnouncementMsg && groupAdminRole),
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        };

        try {
          const { data, error } = await supabase
            .from('chat_group_messages')
            .insert(fullPayload)
            .select(`
              id, group_id, sender_id, content, is_announcement, attachment_url, attachment_name, attachment_type, created_at,
              sender:profiles!chat_group_messages_sender_id_fkey(username, avatar_url)
            `)
            .single();

          if (error) throw error;
          sentData = data;
        } catch (insertErr) {
          // Fallback if attachment columns are not in schema cache
          if (insertErr?.message?.includes('attachment_') || insertErr?.message?.includes('column')) {
            const fallbackContent = attachmentUrl 
              ? `${text ? text + ' ' : ''}[Attachment: ${attachmentName || 'file'}](${attachmentUrl})`
              : text;
            const { data, error } = await supabase
              .from('chat_group_messages')
              .insert({
                group_id: selectedGroup.id,
                sender_id: myId,
                content: fallbackContent,
                is_announcement: Boolean(isAnnouncementMsg && groupAdminRole),
              })
              .select(`
                id, group_id, sender_id, content, is_announcement, created_at,
                sender:profiles!chat_group_messages_sender_id_fkey(username, avatar_url)
              `)
              .single();
            if (error) throw error;
            sentData = data;
          } else {
            throw insertErr;
          }
        }

        setMessages(prev => [...prev, sentData]);

        // Send notifications to other group members
        groupMembers.forEach(mem => {
          if (mem.user_id !== myId) {
            createNotification({
              userId: mem.user_id,
              actorId: myId,
              type: isAnnouncementMsg ? 'group_announcement' : 'comment',
              entityId: selectedGroup.id,
            });
          }
        });
      } else if (selectedUser) {
        let sentData = null;
        const fullPayload = {
          sender_id: myId,
          receiver_id: selectedUser.id,
          content: text || (attachmentName ? `Shared attachment: ${attachmentName}` : ''),
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        };

        try {
          const { data, error } = await supabase
            .from('messages')
            .insert(fullPayload)
            .select()
            .single();

          if (error) throw error;
          sentData = data;
        } catch (insertErr) {
          // Fallback if attachment columns are not in schema cache
          if (insertErr?.message?.includes('attachment_') || insertErr?.message?.includes('column')) {
            const fallbackContent = attachmentUrl
              ? `${text ? text + ' ' : ''}[Attachment: ${attachmentName || 'file'}](${attachmentUrl})`
              : text;
            const { data, error } = await supabase
              .from('messages')
              .insert({
                sender_id: myId,
                receiver_id: selectedUser.id,
                content: fallbackContent,
              })
              .select()
              .single();
            if (error) throw error;
            sentData = data;
          } else {
            throw insertErr;
          }
        }

        setMessages(prev => {
          if (prev.some(m => m.id === sentData.id)) return prev;
          return [...prev, sentData];
        });

        if (sentData?.id) {
          createNotification({
            userId: selectedUser.id,
            actorId: myId,
            type: 'comment',
            entityId: sentData.id,
          });
        }

        setConversations(prev => {
          const exists = prev.some(c => c.id === selectedUser.id);
          if (!exists) {
            return [{ ...selectedUser, lastMessage: text }, ...prev];
          }
          return prev.map(c => (c.id === selectedUser.id ? { ...c, lastMessage: text } : c));
        });
      }

      setNewMessage('');
      removeAttachment();
      setIsAnnouncementMsg(false);
    } catch (err) {
      toast.error('Failed to send message: ' + (err.message || ''));
    } finally {
      setSending(false);
      setUploadingAttachment(false);
      inputRef.current?.focus();
    }
  };

  // Copy Group Share Link
  const handleShareGroupLink = () => {
    if (!selectedGroup) return;
    const shareUrl = `${window.location.origin}/chat?group=${selectedGroup.id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Group invite link copied to clipboard! 📋');
  };

  // Admin: Toggle Public vs Private Access in Database
  const handleTogglePrivacy = async () => {
    if (!selectedGroup || !groupAdminRole) return;
    const newStatus = !selectedGroup.is_private;
    try {
      const { error } = await supabase
        .from('chat_groups')
        .update({ is_private: newStatus })
        .eq('id', selectedGroup.id);

      if (error) throw error;

      setSelectedGroup(prev => ({ ...prev, is_private: newStatus }));
      setGroups(prev =>
        prev.map(g => (g.id === selectedGroup.id ? { ...g, is_private: newStatus } : g))
      );
      toast.success(newStatus ? 'Group is now Private 🔒' : 'Group is now Public 🌐');
    } catch (err) {
      toast.error('Failed to update group privacy');
    }
  };

  // Admin: Update Announcement
  const handleSaveAnnouncement = async () => {
    if (!selectedGroup || !groupAdminRole) return;
    setSavingAnnouncement(true);
    try {
      const { error } = await supabase
        .from('chat_groups')
        .update({
          announcement: newAnnouncementText.trim() || null,
          announcement_updated_at: new Date().toISOString(),
        })
        .eq('id', selectedGroup.id);

      if (error) throw error;

      if (newAnnouncementText.trim()) {
        await supabase.from('chat_group_messages').insert({
          group_id: selectedGroup.id,
          sender_id: myId,
          content: `📢 [ANNOUNCEMENT]: ${newAnnouncementText.trim()}`,
          is_announcement: true,
        });
      }

      setSelectedGroup(prev => ({ ...prev, announcement: newAnnouncementText.trim() }));
      toast.success('Announcement updated!');
    } catch (err) {
      toast.error('Failed to update announcement');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  // Admin: Remove Member from Group
  const handleRemoveMember = async (userId, username) => {
    if (!groupAdminRole || !selectedGroup) return;
    if (userId === myId) {
      toast.error('You cannot remove yourself');
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_group_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', userId);

      if (error) throw error;

      setGroupMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success(`Removed @${username} from group`);

      await supabase.from('chat_group_messages').insert({
        group_id: selectedGroup.id,
        sender_id: myId,
        content: `⚠️ @${username} was removed from the group by an admin.`,
        is_announcement: true,
      });
    } catch (err) {
      toast.error('Failed to remove member');
    }
  };

  // Admin: Delete Entire Group
  const handleDeleteGroup = async () => {
    if (!groupAdminRole || !selectedGroup) return;
    if (!window.confirm(`Are you sure you want to permanently delete "${selectedGroup.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chat_groups')
        .delete()
        .eq('id', selectedGroup.id);

      if (error) throw error;

      toast.success('Group deleted');
      setShowGroupAdminModal(false);
      setSelectedGroup(null);
      await loadGroups();
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  // Admin: Promote Member
  const handlePromoteAdmin = async (userId, username) => {
    if (!groupAdminRole || !selectedGroup) return;
    try {
      const { error } = await supabase
        .from('chat_group_members')
        .update({ role: 'admin' })
        .eq('group_id', selectedGroup.id)
        .eq('user_id', userId);

      if (error) throw error;

      setGroupMembers(prev =>
        prev.map(m => (m.user_id === userId ? { ...m, role: 'admin' } : m))
      );
      toast.success(`Promoted @${username} to Admin! 🛡️`);
    } catch (err) {
      toast.error('Failed to promote member');
    }
  };

  // Search & Add Members
  const handleSearchNewMembers = async (q) => {
    setMemberSearchQuery(q);
    if (!q.trim()) {
      setMemberSearchResults([]);
      return;
    }
    const existingIds = groupMembers.map(m => m.user_id);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(5);

    const available = (data || []).filter(u => !existingIds.includes(u.id));
    setMemberSearchResults(available);
  };

  const handleAddMemberToGroup = async (user) => {
    if (!selectedGroup) return;
    try {
      const { error } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: selectedGroup.id,
          user_id: user.id,
          role: 'member',
        });

      if (error) throw error;

      setGroupMembers(prev => [
        ...prev,
        {
          id: `mem_${Date.now()}`,
          user_id: user.id,
          role: 'member',
          profiles: user,
        },
      ]);
      setMemberSearchQuery('');
      setMemberSearchResults([]);
      toast.success(`Added @${user.username} to group!`);

      // Notify added user
      createNotification({
        userId: user.id,
        actorId: myId,
        type: 'connection_accepted',
        entityId: selectedGroup.id,
      });

      await supabase.from('chat_group_messages').insert({
        group_id: selectedGroup.id,
        sender_id: myId,
        content: `👋 @${user.username} joined the group.`,
        is_announcement: false,
      });
    } catch (err) {
      toast.error('Failed to add member');
    }
  };

  const cardStyle = {
    backgroundColor: 'var(--surface-color)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--card-shadow)',
  };

  return (
    <div
      className="min-h-screen py-6 px-4 md:px-8"
      style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-color)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6 h-[calc(100vh-130px)]">
        {/* Left Sidebar: Conversations & Groups */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className={`w-full md:w-80 rounded-2xl flex flex-col overflow-hidden shrink-0 ${
            (selectedUser || selectedGroup) ? 'hidden md:flex' : 'flex'
          }`}
          style={cardStyle}
        >
          {/* Header & Tabs */}
          <div className="p-4 border-b border-[#f1e4d3] dark:border-[#2b1c13]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageSquare size={19} className="text-orange-500" />
                Messages & Groups
              </h2>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 transition-all shadow-xs cursor-pointer"
                title="Create a Group"
              >
                <Plus size={13} strokeWidth={3} />
                <span>New Group</span>
              </button>
            </div>

            {/* Direct / Groups Switcher Tabs */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-stone-100 dark:bg-stone-900 border border-[#f1e4d3] dark:border-[#2b1c13] mb-3">
              <button
                onClick={() => {
                  setActiveTab('groups');
                  if (groups.length > 0 && !selectedGroup) {
                    setSelectedUser(null);
                    setSelectedGroup(groups[0]);
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'groups'
                    ? 'bg-white dark:bg-stone-800 text-orange-600 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                Groups ({groups.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('direct');
                  if (conversations.length > 0 && !selectedUser) setSelectedUser(conversations[0]);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'direct'
                    ? 'bg-white dark:bg-stone-800 text-orange-600 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                Direct ({conversations.length})
              </button>
            </div>

            {/* Search Developer for 1:1 chat */}
            {activeTab === 'direct' && (
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleUserSearch}
                  placeholder="Find developers to message..."
                  className="w-full rounded-xl pl-9 pr-8 py-2 text-xs outline-none bg-stone-50 dark:bg-stone-900 border border-[#f1e4d3] dark:border-[#2b1c13] text-stone-900 dark:text-stone-100 focus:border-orange-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )}

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 rounded-xl border border-[#f1e4d3] dark:border-[#2b1c13] bg-white dark:bg-stone-900 overflow-hidden shadow-lg z-20">
                {searchResults.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startChat(u)}
                    className="w-full flex items-center gap-2.5 p-2.5 text-xs text-left hover:bg-orange-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-[11px] shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        u.username[0]?.toUpperCase()
                      )}
                    </div>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">@{u.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List: Groups OR Direct Chats */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {activeTab === 'groups' ? (
              groups.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  No groups joined yet.<br />Click "+ New Group" above to create one!
                </div>
              ) : (
                groups.map(grp => {
                  const isSelected = selectedGroup?.id === grp.id;
                  return (
                    <button
                      key={grp.id}
                      onClick={() => {
                        setSelectedUser(null);
                        setSelectedGroup(grp);
                      }}
                      className={`w-full flex items-center gap-3 p-3.5 border-b border-[#f1e4d3]/60 dark:border-[#2b1c13] transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500/10 border-l-4 border-l-orange-500 text-orange-600 font-bold'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-900/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ea580c] to-[#f97316] text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                        <Users size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate text-stone-900 dark:text-stone-100">
                            {grp.name}
                          </span>
                          <div className="flex items-center gap-1">
                            {grp.is_private ? (
                              <Lock size={11} className="text-stone-400" title="Private" />
                            ) : (
                              <Globe size={11} className="text-stone-400" title="Public" />
                            )}
                            {grp.myRole === 'admin' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 font-bold border border-orange-200">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-stone-500 truncate mt-0.5">
                          {grp.description || 'Developer Team Collective'}
                        </p>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              conversations.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
                  No direct conversations yet.<br />Search a developer above to connect!
                </div>
              ) : (
                conversations.map(user => {
                  const isSelected = selectedUser?.id === user.id && !selectedGroup;
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedGroup(null);
                        setSelectedUser(user);
                      }}
                      className={`w-full flex items-center gap-3 p-3.5 border-b border-[#f1e4d3]/60 dark:border-[#2b1c13] transition-all text-left cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500/10 border-l-4 border-l-orange-500 text-orange-600 font-bold'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-900/60'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0 overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user.username?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold truncate text-stone-900 dark:text-stone-100">
                            @{user.username}
                          </span>
                        </div>
                        {user.lastMessage && (
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">{user.lastMessage}</p>
                        )}
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </motion.div>

        {/* Right Chat Area */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex-1 rounded-2xl flex flex-col overflow-hidden ${
            !selectedUser && !selectedGroup ? 'hidden md:flex' : 'flex'
          }`}
          style={cardStyle}
        >
          {!selectedUser && !selectedGroup ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-400 p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-stone-900 border border-orange-200 dark:border-stone-800 flex items-center justify-center text-orange-500">
                <MessageSquare size={28} />
              </div>
              <p className="font-bold text-base text-stone-800 dark:text-stone-200">Select a group or developer</p>
              <p className="text-xs max-w-sm">
                Collaborate in public or private developer teams, share files, and broadcast announcements.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-[#f1e4d3] dark:border-[#2b1c13] flex items-center justify-between bg-stone-50/50 dark:bg-stone-900/30">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setSelectedGroup(null);
                    }}
                    className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 md:hidden cursor-pointer"
                  >
                    <ArrowLeft size={18} />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-xs">
                    {selectedGroup ? (
                      <Users size={18} />
                    ) : selectedUser?.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedUser?.username?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {selectedGroup ? selectedGroup.name : `@${selectedUser?.username}`}
                      </span>
                      {selectedGroup && (
                        <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 font-bold border border-orange-200">
                          {selectedGroup.is_private ? <Lock size={9} /> : <Globe size={9} />}
                          {selectedGroup.is_private ? 'Private' : 'Public'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 truncate">
                      {selectedGroup
                        ? `${groupMembers.length || 'Team'} members · ${selectedGroup.myRole === 'admin' ? '🛡️ You are Admin' : 'Member'}`
                        : 'Active Developer on Connectra'}
                    </p>
                  </div>
                </div>

                {/* Group Action Controls: Share Link & Admin Panel */}
                {selectedGroup && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleShareGroupLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-bold text-stone-700 dark:text-stone-200 hover:border-orange-500 transition-colors cursor-pointer shadow-xs"
                      title="Copy Share Link"
                    >
                      <Share2 size={13} className="text-orange-500" />
                      <span className="hidden sm:inline">Share</span>
                    </button>

                    <button
                      onClick={() => setShowGroupAdminModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-orange-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs font-bold text-stone-700 dark:text-stone-200 hover:border-orange-500 transition-colors cursor-pointer shadow-xs"
                      title="Manage Group Members & Settings"
                    >
                      <Settings size={14} className="text-orange-500" />
                      <span>{groupAdminRole ? 'Admin Panel' : 'Members'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Group Pinned Announcement Banner */}
              {selectedGroup?.announcement && (
                <div className="p-3 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-transparent border-b border-orange-500/20 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <Megaphone size={16} className="text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-orange-600 uppercase text-[10px] tracking-wider block">
                        Pinned Group Announcement
                      </span>
                      <p className="text-stone-800 dark:text-stone-200 text-xs mt-0.5 leading-relaxed">
                        {selectedGroup.announcement}
                      </p>
                    </div>
                  </div>
                  {groupAdminRole && (
                    <button
                      onClick={() => setShowGroupAdminModal(true)}
                      className="text-[10px] font-bold text-orange-600 hover:underline shrink-0 cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}

              {/* Messages Flow */}
              <div
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar text-sm"
                style={{ backgroundColor: 'var(--bg-color)' }}
              >
                {loadingMessages ? (
                  <Loader />
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-xs text-stone-400 gap-2">
                    <span>👋 No messages yet. Say hello and kick off collaboration!</span>
                  </div>
                ) : (
                  <AnimatePresence>
                    {messages.map(msg => {
                      const isMe = msg.sender_id === myId;
                      const isAnnouncement = msg.is_announcement;

                      if (isAnnouncement) {
                        return (
                          <div key={msg.id} className="flex justify-center my-1.5">
                            <div className="max-w-[85%] px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-600 text-xs font-semibold flex items-center gap-2 shadow-2xs">
                              <Megaphone size={14} className="shrink-0" />
                              <span>{msg.content}</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          {/* Sender name for group messages */}
                          {selectedGroup && !isMe && msg.sender?.username && (
                            <span className="text-[10px] font-bold text-stone-500 ml-1 mb-0.5">
                              @{msg.sender.username}
                            </span>
                          )}

                          <div
                            className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed relative shadow-2xs ${
                              isMe
                                ? 'bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white rounded-br-none font-medium'
                                : 'bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 border border-[#f1e4d3] dark:border-[#2b1c13] rounded-bl-none'
                            }`}
                          >
                            {/* Message Attachment Preview */}
                            {msg.attachment_url && (
                              <div className="mb-2 rounded-xl overflow-hidden border border-white/20">
                                {msg.attachment_type === 'image' ? (
                                  <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                    <img
                                      src={msg.attachment_url}
                                      alt="attachment"
                                      className="max-h-48 w-full object-cover rounded-lg hover:scale-101 transition-transform"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={msg.attachment_name || 'file'}
                                    className={`flex items-center gap-2 p-2 rounded-lg font-mono text-xs ${
                                      isMe ? 'bg-black/20 text-white' : 'bg-stone-100 dark:bg-stone-700 text-stone-800 dark:text-stone-100'
                                    }`}
                                  >
                                    <FileText size={16} />
                                    <span className="truncate max-w-[180px]">{msg.attachment_name || 'Download Attachment'}</span>
                                    <ExternalLink size={12} className="ml-auto opacity-75" />
                                  </a>
                                )}
                              </div>
                            )}

                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <p
                              className={`text-[9px] mt-1 text-right ${
                                isMe ? 'text-white/70' : 'text-stone-400'
                              }`}
                            >
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar & Attachment Preview */}
              <div className="p-3 border-t border-[#f1e4d3] dark:border-[#2b1c13] bg-white dark:bg-stone-900 flex flex-col gap-2">
                {/* Active Attachment Preview before sending */}
                {attachmentFile && (
                  <div className="p-2 rounded-xl bg-orange-50 dark:bg-stone-800 border border-orange-200 dark:border-stone-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {attachmentPreview ? (
                        <img src={attachmentPreview} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                      ) : (
                        <FileText size={16} className="text-orange-500 shrink-0" />
                      )}
                      <span className="text-xs truncate font-medium text-stone-800 dark:text-stone-200">
                        {attachmentFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="p-1 text-stone-400 hover:text-rose-500 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* Admin Announcement checkbox toggle for Group messages */}
                {selectedGroup && groupAdminRole && (
                  <div className="flex items-center gap-2 px-1">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-orange-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAnnouncementMsg}
                        onChange={e => setIsAnnouncementMsg(e.target.checked)}
                        className="rounded accent-orange-500"
                      />
                      <span>Post as Official Group Announcement 📢</span>
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* File Attachment Input (hidden) */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl border border-[#f1e4d3] dark:border-[#2b1c13] hover:border-orange-500 text-stone-500 hover:text-orange-600 transition-colors cursor-pointer"
                    title="Attach document, image, or code file"
                  >
                    <Paperclip size={16} />
                  </button>

                  <input
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={
                      selectedGroup
                        ? `Message ${selectedGroup.name}...`
                        : `Message @${selectedUser?.username}...`
                    }
                    className="flex-1 rounded-xl px-3.5 py-2.5 text-xs outline-none bg-stone-50 dark:bg-stone-800 border border-[#f1e4d3] dark:border-[#2b1c13] text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:border-orange-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || (!newMessage.trim() && !attachmentFile)}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 disabled:opacity-40 transition-all cursor-pointer shadow-sm shadow-orange-500/20"
                    title="Send"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* CREATE GROUP MODAL WITH PUBLIC/PRIVATE SETTING */}
      <AnimatePresence>
        {showCreateGroupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl p-6 bg-white dark:bg-stone-900 border border-[#f1e4d3] dark:border-[#2b1c13] shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#2b1c13]">
                <h3 className="font-bold text-base flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <Users className="text-orange-500" size={18} />
                  Create Developer Group
                </h3>
                <button
                  onClick={() => setShowCreateGroupModal(false)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="mt-4 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g. Next.js Builders, AppSec Collective"
                    className="w-full rounded-xl p-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-[#f1e4d3] dark:border-[#2b1c13] outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Topic / Description
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupDesc}
                    onChange={e => setNewGroupDesc(e.target.value)}
                    placeholder="What is this collective building or discussing?"
                    className="w-full rounded-xl p-2.5 text-xs bg-stone-50 dark:bg-stone-800 border border-[#f1e4d3] dark:border-[#2b1c13] outline-none focus:border-orange-500"
                  />
                </div>

                {/* Privacy Radio: Public vs Private */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                    Access Permission
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewGroupIsPrivate(false)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        !newGroupIsPrivate
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-bold'
                          : 'border-[#f1e4d3] dark:border-[#2b1c13] bg-stone-50 dark:bg-stone-800 text-stone-600'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs">
                        <Globe size={14} /> Public
                      </span>
                      <span className="text-[10px] font-normal opacity-75">
                        Anyone can discover & join
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewGroupIsPrivate(true)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        newGroupIsPrivate
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600 font-bold'
                          : 'border-[#f1e4d3] dark:border-[#2b1c13] bg-stone-50 dark:bg-stone-800 text-stone-600'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 text-xs">
                        <Lock size={14} /> Private
                      </span>
                      <span className="text-[10px] font-normal opacity-75">
                        Invite & Admin approved only
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingGroup || !newGroupName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#ea580c] to-[#f97316] text-white hover:brightness-105 disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {creatingGroup ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GROUP ADMIN & MEMBERS MANAGEMENT MODAL */}
      <AnimatePresence>
        {showGroupAdminModal && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl p-6 bg-white dark:bg-stone-900 border border-[#f1e4d3] dark:border-[#2b1c13] shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#f1e4d3] dark:border-[#2b1c13]">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2 text-stone-900 dark:text-stone-100">
                    <Shield className="text-orange-500" size={18} />
                    {selectedGroup.name} · {groupAdminRole ? 'Admin Control' : 'Members'}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">{groupMembers.length} collective members</p>
                </div>
                <button
                  onClick={() => setShowGroupAdminModal(false)}
                  className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Privacy Setting Toggle (Admin Only) */}
              {groupAdminRole && (
                <div className="mt-4 p-3 rounded-xl border border-[#f1e4d3] dark:border-[#2b1c13] bg-stone-50 dark:bg-stone-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedGroup.is_private ? (
                      <Lock size={16} className="text-orange-500" />
                    ) : (
                      <Globe size={16} className="text-emerald-500" />
                    )}
                    <div>
                      <span className="text-xs font-bold block text-stone-900 dark:text-stone-100">
                        {selectedGroup.is_private ? 'Private Group' : 'Public Group'}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        {selectedGroup.is_private ? 'Only members with link can join' : 'Open to all developers'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePrivacy}
                    className="px-3 py-1.5 rounded-lg border border-orange-200 text-xs font-bold text-orange-600 hover:bg-orange-50 cursor-pointer"
                  >
                    Switch to {selectedGroup.is_private ? 'Public' : 'Private'}
                  </button>
                </div>
              )}

              {/* Announcement Editor (Admin Only) */}
              {groupAdminRole && (
                <div className="mt-4 p-3.5 rounded-xl border border-orange-200 dark:border-stone-800 bg-orange-50/50 dark:bg-stone-800/40 flex flex-col gap-2">
                  <label className="text-xs font-bold text-orange-600 flex items-center gap-1.5">
                    <Megaphone size={14} /> Group Broadcast Announcement
                  </label>
                  <textarea
                    rows={2}
                    value={newAnnouncementText}
                    onChange={e => setNewAnnouncementText(e.target.value)}
                    placeholder="Set an important pinned announcement for all group members..."
                    className="w-full rounded-xl p-2.5 text-xs bg-white dark:bg-stone-900 border border-[#f1e4d3] dark:border-[#2b1c13] outline-none focus:border-orange-500"
                  />
                  <div className="flex justify-end gap-2">
                    {selectedGroup.announcement && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewAnnouncementText('');
                          handleSaveAnnouncement();
                        }}
                        className="text-xs text-rose-500 hover:underline cursor-pointer"
                      >
                        Remove Announcement
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAnnouncement}
                      disabled={savingAnnouncement}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-colors cursor-pointer shadow-xs"
                    >
                      {savingAnnouncement ? 'Saving...' : 'Save Announcement'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add New Members (Admin only) */}
              {groupAdminRole && (
                <div className="mt-4">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
                    Add Developers to Group
                  </label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      value={memberSearchQuery}
                      onChange={e => handleSearchNewMembers(e.target.value)}
                      placeholder="Search developer username..."
                      className="w-full rounded-xl pl-8 pr-3 py-2 text-xs bg-stone-50 dark:bg-stone-800 border border-[#f1e4d3] dark:border-[#2b1c13] outline-none focus:border-orange-500"
                    />
                  </div>

                  {memberSearchResults.length > 0 && (
                    <div className="mt-2 rounded-xl border border-[#f1e4d3] dark:border-[#2b1c13] bg-white dark:bg-stone-800 overflow-hidden shadow-sm">
                      {memberSearchResults.map(u => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2.5 border-b border-[#f1e4d3]/60 dark:border-[#2b1c13] text-xs last:border-0"
                        >
                          <span className="font-semibold text-stone-800 dark:text-stone-200">@{u.username}</span>
                          <button
                            type="button"
                            onClick={() => handleAddMemberToGroup(u)}
                            className="px-2.5 py-1 rounded-lg bg-orange-500 text-white font-bold text-[11px] hover:bg-orange-600 transition-colors cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Current Members List */}
              <div className="mt-5">
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-2">
                  Group Members ({groupMembers.length})
                </span>
                <div className="flex flex-col gap-2">
                  {groupMembers.map(m => {
                    const isGroupAdmin = m.role === 'admin';
                    const isSelf = m.user_id === myId;
                    const username = m.profiles?.username || 'Developer';

                    return (
                      <div
                        key={m.id || m.user_id}
                        className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800 border border-[#f1e4d3] dark:border-[#2b1c13] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                            {m.profiles?.avatar_url ? (
                              <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              username[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate text-stone-900 dark:text-stone-100">
                                @{username}
                              </span>
                              {isGroupAdmin && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-600 font-bold border border-orange-200">
                                  Admin
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[9px] text-stone-400 font-medium">(You)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {groupAdminRole && !isSelf && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isGroupAdmin && (
                              <button
                                type="button"
                                onClick={() => handlePromoteAdmin(m.user_id, username)}
                                className="px-2 py-1 rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-orange-600 font-semibold text-[10px] transition-colors cursor-pointer"
                                title="Promote to Admin"
                              >
                                Make Admin
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.user_id, username)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remove from group"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Danger Zone: Delete Group */}
              {groupAdminRole && (
                <div className="mt-6 pt-4 border-t border-[#f1e4d3] dark:border-[#2b1c13] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-rose-600 block">Delete Group</span>
                    <span className="text-[10px] text-stone-500">Permanently delete this group and all its messages</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteGroup}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors cursor-pointer shadow-xs"
                  >
                    Delete Group
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
