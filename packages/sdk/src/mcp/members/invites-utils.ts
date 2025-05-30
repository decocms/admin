import type { Client } from "../../storage/index.ts";
import { type AppContext, getEnv } from "../context.ts";

// Email sending functionality

export function sanitizeTeamName(name: string): string {
  return name.replace(/[<>&'"]/g, "");
}

export interface EmailBodyProps {
  inviteId: string;
  teamName: string;
  inviter: string;
  roles: Array<string>;
}

export function generateEmailBody(
  { teamName, inviter, roles }: EmailBodyProps,
) {
  const cleanTeamName = sanitizeTeamName(teamName);
  const cleanInviter = sanitizeTeamName(inviter);

  function formatRoles(roles: Array<string>) {
    const capitalizedRoles = roles.map((role) =>
      role.charAt(0).toUpperCase() + role.slice(1)
    );

    if (capitalizedRoles.length === 1) {
      return capitalizedRoles[0];
    } else if (capitalizedRoles.length === 2) {
      return `${capitalizedRoles[0]} and ${capitalizedRoles[1]}`;
    } else {
      const lastRole = capitalizedRoles.pop();
      return `${capitalizedRoles.join(", ")}, and ${lastRole}`;
    }
  }

  const formattedRoles = formatRoles([...roles]);

  const emailHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<title>Email Template</title>
</head>
<body>
<!-- Main Table -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; margin: 0 auto; text-align: center;">
  <!-- Logo Row -->
  <tr>
    <td style="padding: 24px;">
      <img width="144px" height="40px" style="width:144px;height:40px;" src="https://deco.chat/img/deco-chat-logo.png" alt="deco.chat logo"/>
    </td>
  </tr>

  <!-- Message Row -->
  <tr>
    <td style="color: #000; font-size: 24px; padding: 16px;">
      <strong>${cleanInviter}</strong> has invited you to join the team <strong>${cleanTeamName}</strong> as <strong>${formattedRoles}</strong>.
    </td>
  </tr>

  <!-- Button Row -->
  <tr>
    <td style="padding-bottom: 24px; padding-top: 12px;">
      <!-- Use a link instead of a button for better email client support -->
      <a href="https://deco.chat/invites" target="_blank" style="display: inline;   color: #fff;   font-size: 18px;   font-weight: 700;   line-height: 24px;    text-decoration: none;    border-radius: 8px;   background: #0d1717; padding: 13px 32px;">Join team</a>
    </td>
  </tr>

 </table>
<!-- End Main Table -->
</body>
</html>
`;

  return emailHTML;
}

export async function sendInviteEmail(
  { id, team_name, invited_email, inviter, roles }: {
    id: string;
    team_name: string;
    invited_email: string;
    inviter: string;
    roles: Array<string>;
  },
  c: AppContext,
) {
  const htmlProps: EmailBodyProps = {
    inviteId: id,
    teamName: team_name,
    inviter,
    roles,
  };
  const { RESEND_API_KEY } = getEnv(c);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "deco.chat <noreply@deco.chat>",
      to: [invited_email],
      subject: "Team invitation",
      html: generateEmailBody(htmlProps),
    }),
  });

  if (res.status >= 400) {
    console.error("[Resend Error] error sending email", await res.text());
    throw new Error(res.statusText);
  }

  return res;
}

// Helper functions for invite handling
export async function getInviteIdByEmailAndTeam({ email, teamId }: {
  email: string;
  teamId: string;
}, db: Client) {
  const { data } = await db.from("invites").select("id").eq(
    "invited_email",
    email,
  ).eq("team_id", Number(teamId));
  return data;
}

export async function checkAlreadyExistUserIdInTeam({
  userId,
  teamId,
  email,
}: {
  userId?: string;
  teamId: string;
  email?: string;
}, db: Client) {
  if (userId) {
    const { data } = await db.from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", Number(teamId))
      .is("deleted_at", null)
      .limit(1);

    return data && data.length > 0;
  } else if (email) {
    const { data: profiles } = await db.from("profiles")
      .select("user_id")
      .eq("email", email.toLowerCase());

    if (!profiles || profiles.length === 0) return false;

    const userId = profiles[0].user_id;
    const { data } = await db.from("members")
      .select("id")
      .eq("user_id", userId)
      .eq("team_id", Number(teamId))
      .is("deleted_at", null)
      .limit(1);

    return data && data.length > 0;
  }

  return false;
}

export async function insertInvites(
  invites: Array<{
    invited_email: string;
    team_id: number;
    team_name: string;
    inviter_id: string;
    invited_roles: Array<{ id: number; name: string }>;
  }>,
  db: Client,
) {
  const { data, error } = await db.from("invites").insert(invites).select();

  if (error) {
    return { error, status: 400 };
  }

  return { data, error: null, status: 201 };
}

export async function getTeamById(teamId: string, db: Client) {
  const { data, error } = await db.from("teams")
    .select("id, name, members(user_id)")
    .eq("id", Number(teamId))
    .single();

  return { data, error };
}

export function userBelongsToTeam(
  team: { members: Array<{ user_id: string | null }> },
  userId?: string,
) {
  if (!userId) return false;
  return team.members.some((member) => member.user_id === userId);
}
