export const notMigrated = (feature: string): never => {
  throw new Error(`${feature} chưa migrate sang Supabase.`);
};
