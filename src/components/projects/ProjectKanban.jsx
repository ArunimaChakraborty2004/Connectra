import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from '../../lib/toast';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  { id: 'in-progress', title: 'In Progress', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'review', title: 'Review', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  { id: 'completed', title: 'Completed', color: 'bg-green-500/10 text-green-400 border-green-500/20' }
];

export default function ProjectKanban({ projectId, userRole }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'todo', priority: 'medium' });

  const hasAccess = userRole === 'owner' || userRole === 'admin' || userRole === 'developer';

  useEffect(() => {
    fetchTasks();
  }, [projectId]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*, assignee:profiles(username, avatar_url)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const handleDragStart = (e, taskId) => {
    if (!hasAccess) return;
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    if (!hasAccess) return;
    
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to move task');
      fetchTasks(); // Revert on failure
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...newTask, project_id: projectId }])
      .select()
      .single();

    if (error) {
      toast.error('Failed to add task');
    } else {
      toast.success('Task added');
      setTasks([data, ...tasks]);
      setShowAdd(false);
      setNewTask({ title: '', description: '', status: 'todo', priority: 'medium' });
    }
  };

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  };

  if (loading) return <div className="animate-pulse h-64 bg-surface rounded-xl"></div>;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-[1000px] h-[calc(100vh-300px)]">
        {COLUMNS.map(col => (
          <div 
            key={col.id} 
            className="flex-1 flex flex-col bg-surface/30 rounded-2xl p-4 border border-white/5"
            onDrop={(e) => handleDrop(e, col.id)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${col.color}`}>
                {col.title} ({tasks.filter(t => t.status === col.id).length})
              </h3>
              {col.id === 'todo' && hasAccess && (
                <button onClick={() => setShowAdd(true)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                  <Plus size={18} />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {showAdd && col.id === 'todo' && (
                <form onSubmit={addTask} className="glass-panel p-3 rounded-xl border-dashed border-primary/50">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Task title..." 
                    className="w-full bg-transparent text-main text-sm font-semibold outline-none mb-2"
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium">Add</button>
                    <button type="button" onClick={() => setShowAdd(false)} className="text-xs text-muted hover:text-main px-2 py-1.5 rounded-lg">Cancel</button>
                  </div>
                </form>
              )}

              {tasks.filter(t => t.status === col.id).map(task => (
                <div 
                  key={task.id}
                  draggable={hasAccess}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  className={`glass-panel p-4 rounded-xl cursor-grab active:cursor-grabbing border-l-4 ${
                    task.priority === 'urgent' ? 'border-l-red-500' :
                    task.priority === 'high' ? 'border-l-orange-500' :
                    task.priority === 'low' ? 'border-l-green-500' : 'border-l-primary'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-semibold text-sm leading-tight text-main">{task.title}</h4>
                    {hasAccess && (
                      <button onClick={() => deleteTask(task.id)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {task.description && <p className="text-xs text-muted mt-2 line-clamp-2">{task.description}</p>}
                  
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted uppercase">
                      {task.priority}
                    </span>
                    {task.assignee && (
                      <div className="h-6 w-6 rounded-full bg-surface overflow-hidden tooltip" title={task.assignee.username}>
                        {task.assignee.avatar_url ? <img src={task.assignee.avatar_url} alt="" /> : task.assignee.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
