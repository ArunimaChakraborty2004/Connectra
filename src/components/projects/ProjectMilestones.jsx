import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Flag, Trash2, Calendar } from 'lucide-react';
import { toast } from '../../lib/toast';

export default function ProjectMilestones({ projectId, userRole }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMilestone, setNewMilestone] = useState({ name: '', due_date: '', status: 'pending' });

  const hasAccess = userRole === 'owner' || userRole === 'admin' || userRole === 'developer';

  useEffect(() => {
    fetchMilestones();
  }, [projectId]);

  const fetchMilestones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('milestones')
      .select('*, tasks(id)')
      .eq('project_id', projectId)
      .order('due_date', { ascending: true });
    
    if (!error && data) {
      setMilestones(data);
    }
    setLoading(false);
  };

  const addMilestone = async (e) => {
    e.preventDefault();
    if (!newMilestone.name.trim()) return;

    const { error } = await supabase
      .from('milestones')
      .insert([{ 
        project_id: projectId, 
        name: newMilestone.name, 
        due_date: newMilestone.due_date || null,
        status: newMilestone.status
      }]);

    if (error) {
      toast.error('Failed to create milestone');
    } else {
      toast.success('Milestone created');
      fetchMilestones();
      setShowAdd(false);
      setNewMilestone({ name: '', due_date: '', status: 'pending' });
    }
  };

  const deleteMilestone = async (id) => {
    if (!confirm('Delete this milestone? Associated tasks will be detached.')) return;
    const { error } = await supabase.from('milestones').delete().eq('id', id);
    if (!error) {
      toast.success('Milestone deleted');
      fetchMilestones();
    } else {
      toast.error('Failed to delete milestone');
    }
  };

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-xl"></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2"><Flag size={20} className="text-primary"/> Project Milestones</h2>
        {hasAccess && (
          <button onClick={() => setShowAdd(!showAdd)} className="vibrant-btn px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            <Plus size={16} /> New Milestone
          </button>
        )}
      </div>

      {showAdd && hasAccess && (
        <form onSubmit={addMilestone} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Milestone Name</label>
            <input 
              type="text" 
              placeholder="e.g., Sprint 1, Alpha Release..." 
              value={newMilestone.name}
              onChange={e => setNewMilestone({...newMilestone, name: e.target.value})}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-main focus:border-primary/50 outline-none"
              required
            />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Due Date</label>
            <input 
              type="date" 
              value={newMilestone.due_date}
              onChange={e => setNewMilestone({...newMilestone, due_date: e.target.value})}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-main focus:border-primary/50 outline-none"
            />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Status</label>
            <select
              value={newMilestone.status}
              onChange={e => setNewMilestone({...newMilestone, status: e.target.value})}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-main focus:border-primary/50 outline-none"
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl font-medium transition-colors">Save</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 rounded-xl border border-border hover:bg-surface text-muted transition-colors">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {milestones.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted border border-dashed border-border rounded-2xl">
            No milestones created yet.
          </div>
        ) : milestones.map(ms => (
          <div key={ms.id} className="glass-panel p-6 rounded-2xl relative group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-main">{ms.name}</h3>
                {ms.due_date && (
                  <p className="text-sm text-muted flex items-center gap-1 mt-1">
                    <Calendar size={14} /> Due: {new Date(ms.due_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${
                ms.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                ms.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 
                'bg-slate-500/10 text-slate-400 border-slate-500/20'
              }`}>
                {ms.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-6">
              <div className="text-xs font-semibold px-2 py-1 bg-surface border border-border rounded-md text-muted">
                {ms.tasks?.length || 0} Tasks
              </div>
            </div>

            {hasAccess && (
              <button 
                onClick={() => deleteMilestone(ms.id)}
                className="absolute top-4 right-4 p-2 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
