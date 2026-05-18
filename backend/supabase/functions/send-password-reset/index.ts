type RecoveryMethod = "email" | "sms";

type PasswordResetPayload = {
  method?: RecoveryMethod;
  contact?: string;
  code?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function sendEmail(contact: string, code: string): Promise<void> {
  const resendApiKey = requiredEnv("RESEND_API_KEY");
  const resendFromEmail = requiredEnv("RESEND_FROM_EMAIL");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: contact,
      subject: "Your Damayan password reset code",
      text: `Your password reset code is ${code}. It will expire in 10 minutes.`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${details}`);
  }
}

async function sendSms(contact: string, code: string): Promise<void> {
  const accountSid = requiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = requiredEnv("TWILIO_AUTH_TOKEN");
  const fromPhone = requiredEnv("TWILIO_FROM_PHONE");

  const message = `Your Damayan password reset code is ${code}. It expires in 10 minutes.`;
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: fromPhone,
        To: contact,
        Body: message,
      }).toString(),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Twilio request failed (${response.status}): ${details}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = (await req.json()) as PasswordResetPayload;
    const method = payload.method;
    const contact = payload.contact?.trim();
    const code = payload.code?.trim();

    if (method !== "email" && method !== "sms") {
      return jsonResponse({ error: "method must be either 'email' or 'sms'" }, 400);
    }

    if (!contact) {
      return jsonResponse({ error: "contact is required" }, 400);
    }

    if (!code) {
      return jsonResponse({ error: "code is required" }, 400);
    }

    if (method === "email") {
      await sendEmail(contact, code);
    } else {
      await sendSms(contact, code);
    }

    return jsonResponse({ success: true, method, contact });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unknown password reset function error",
      },
      500,
    );
  }
});
