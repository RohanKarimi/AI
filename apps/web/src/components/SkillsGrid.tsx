import { ArrowUpRight, ShieldAlert } from 'lucide-react';
import type { SkillDefinition } from '../data/catalog';

export function SkillsGrid({ skills, selectedSkillId, onSelect }: { skills: SkillDefinition[]; selectedSkillId: string; onSelect: (id: string) => void }) {
  return (
    <section className="section-block" id="skills">
      <div className="section-heading"><div><span className="eyebrow">AI skills</span><h2>Choose a result, not a model</h2></div><p>The interface stays simple for everyone. AIOS routes the task to the best compatible local model.</p></div>
      <div className="skills-grid">
        {skills.map((skill) => (
          <button key={skill.id} className={selectedSkillId === skill.id ? 'skill-card active' : 'skill-card'} onClick={() => onSelect(skill.id)}>
            <span className="skill-icon">{skill.icon}</span>
            <div className="skill-card-top"><h3>{skill.name}</h3><ArrowUpRight size={16} /></div>
            <span className="skill-audience">{skill.audience}</span>
            <p>{skill.description}</p>
            {skill.safetyNote && <span className="skill-note"><ShieldAlert size={13} /> {skill.safetyNote}</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
