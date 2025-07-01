// Simplified toast implementation for WebSecBot
export const useToast = () => {
  return {
    toast: ({ title, description, variant = 'default' }) => {
      console.log(`Toast: ${title} - ${description} (${variant})`);
      // For simplicity, we're using alert for now
      if (title && description) {
        alert(`${title}: ${description}`);
      } else if (title) {
        alert(title);
      }
    }
  };
};

export const toast = (options) => {
  console.log(`Toast: ${options.title} - ${options.description} (${options.variant || 'default'})`);
  if (options.title && options.description) {
    alert(`${options.title}: ${options.description}`);
  } else if (options.title) {
    alert(options.title);
  }
};