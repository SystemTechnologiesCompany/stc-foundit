import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WebhookPayload = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};
type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  channelId: "foundit-updates";
  data: { url: string };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "POST required" }, 405);

  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!expectedSecret || request.headers.get("x-webhook-secret") !== expectedSecret) {
    return respond({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return respond({ error: "Server configuration missing" }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const event = await request.json() as WebhookPayload;
    const notifications: PushMessage[] = [];

    if (event.table === "messages" && event.type === "INSERT" && event.record) {
      const message = event.record;
      const { data: conversation, error: conversationError } = await admin.from("conversations")
        .select("report_id, reports(title), conversation_members(user_id)")
        .eq("id", String(message.conversation_id)).maybeSingle();
      if (conversationError) throw conversationError;
      const report = (conversation?.reports ?? null) as { title?: string } | null;
      const members = (conversation?.conversation_members ?? []) as { user_id: string }[];
      const recipients = members.map((member) => member.user_id).filter((id) => id !== message.sender_id);
      const title = report?.title ?? "your campus report";
      notifications.push(...await buildNotifications(admin, recipients, (token) => ({
        to: token,
        title: "New FoundIt message",
        body: `Someone sent you a message about “${title}”.`,
        sound: "default",
        channelId: "foundit-updates",
        data: { url: `/messages/${message.conversation_id}` },
      })));
    }

    if (event.table === "matches" && event.type === "INSERT" && event.record) {
      const match = event.record;
      const [lostResult, foundResult] = await Promise.all([
        admin.from("reports").select("id, title, user_id").eq("id", String(match.lost_report_id)).maybeSingle(),
        admin.from("reports").select("id, title, user_id").eq("id", String(match.found_report_id)).maybeSingle(),
      ]);
      const lost = lostResult.data;
      const found = foundResult.data;
      if (lost && found && lost.user_id !== found.user_id) {
        notifications.push(...await buildNotifications(admin, [lost.user_id], (token) => ({
          to: token,
          title: "A possible match was found",
          body: `“${found.title}” may match your report “${lost.title}”.`,
          sound: "default",
          channelId: "foundit-updates",
          data: { url: `/reports/${lost.id}` },
        })));
        notifications.push(...await buildNotifications(admin, [found.user_id], (token) => ({
          to: token,
          title: "A possible match was found",
          body: `“${lost.title}” may match your report “${found.title}”.`,
          sound: "default",
          channelId: "foundit-updates",
          data: { url: `/reports/${found.id}` },
        })));
      }
    }

    if (event.table === "reports" && event.type === "UPDATE" && event.record) {
      const report = event.record;
      const oldStatus = event.old_record?.status;
      if (report.status === "returned" && oldStatus !== "returned") {
        const { data: conversations, error: conversationsError } = await admin.from("conversations")
          .select("id, conversation_members(user_id)")
          .eq("report_id", String(report.id));
        if (conversationsError) throw conversationsError;
        const recipientIds = [...new Set((conversations ?? []).flatMap((conversation) =>
          (conversation.conversation_members as { user_id: string }[]).map((member) => member.user_id)
        ))].filter((id) => id !== report.user_id);
        notifications.push(...await buildNotifications(admin, recipientIds, (token) => ({
          to: token,
          title: "Item marked as returned",
          body: `“${report.title}” has been marked as returned.`,
          sound: "default",
          channelId: "foundit-updates",
          data: { url: `/reports/${report.id}` },
        })));
      }
    }

    if (event.table === "news_posts" && event.type === "UPDATE" && event.record && event.old_record) {
      const post = event.record;
      if (post.is_published === true && event.old_record.is_published !== true) {
        const { data: tokens, error: tokenError } = await admin.from("push_tokens").select("token,user_id");
        if (tokenError) throw tokenError;
        const recipients = (tokens ?? []).filter((row) => row.user_id !== post.author_id);
        notifications.push(...recipients.map((row) => ({
          to: row.token,
          title: "An admin posted some news!",
          body: "Take a look!",
          sound: "default" as const,
          channelId: "foundit-updates" as const,
          data: { url: "/news" },
        })));
      }
    }

    const results = await sendPushMessages(notifications);
    if (results.invalidTokens.length) {
      await admin.from("push_tokens").delete().in("token", results.invalidTokens);
    }
    return respond({ ok: true, sent: notifications.length, removedExpiredTokens: results.invalidTokens.length });
  } catch (error) {
    console.error("Push webhook failed:", error instanceof Error ? error.message : "unknown error");
    return respond({ error: "Could not process notification event" }, 500);
  }
});

async function buildNotifications(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
  makeMessage: (token: string) => PushMessage,
) {
  if (!userIds.length) return [];
  const { data, error } = await admin.from("push_tokens").select("token").in("user_id", userIds);
  if (error) throw error;
  return (data ?? []).map((row) => makeMessage(row.token));
}

async function sendPushMessages(messages: PushMessage[]) {
  const invalidTokens: string[] = [];
  for (let index = 0; index < messages.length; index += 100) {
    const batch = messages.slice(index, index + 100);
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`Expo push returned ${response.status}`);
    const result = await response.json() as { data?: { status?: string; details?: { error?: string }; message?: string }[] };
    (result.data ?? []).forEach((ticket, ticketIndex) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(batch[ticketIndex].to);
      }
    });
  }
  return { invalidTokens };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
