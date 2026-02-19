// Direct Supabase authentication integration
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const auth = {
  signInWithOAuth: async (provider: "google" | "apple", opts?: SignInOptions) => {
    // Build the scopes string from extraParams
    const scopes = opts?.extraParams?.scope || "openid email profile";
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: opts?.redirect_uri || window.location.origin,
        scopes,
        queryParams: {
          prompt: opts?.extraParams?.prompt || "consent",
          access_type: opts?.extraParams?.access_type || "offline",
        },
      },
    });

    if (error) {
      return { error };
    }

    return { data };
  },
};
