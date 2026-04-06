export const supabaseSessionMiddleware = (...args: unknown[]) => {
  const next = args[2];
  if (typeof next === "function") {
    next();
  }
};