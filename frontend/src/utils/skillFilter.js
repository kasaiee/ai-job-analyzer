/** Filter skill-analysis rows by match status; null means show every skill. */
export const filterSkillsByStatus = (skills, status) => {
  const source = Array.isArray(skills) ? skills : [];
  return status ? source.filter(skill => skill.status === status) : source;
};
