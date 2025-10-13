import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://auth.deco.cx";
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVER_KEY;
const TEAM_ID = Number(process.env.TEAM_ID);

if (!SUPABASE_SERVER_KEY) {
  throw new Error("SUPABASE_SERVER_KEY is not set");
}

const client = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);

const team = await client.from("teams").select("*").eq("id", TEAM_ID).single();

if (team.error) {
  throw new Error(team.error.message);
}

console.log(team.data);

const members = await client.from("members").select("*").eq("team_id", TEAM_ID);

if (members.error) {
  throw new Error(members.error.message);
}

console.log(members.data);

const memberRolesAgg: {
  id: number;
  member_id: number;
  role_id: number;
}[] = [];

for (const member of members.data) {
  const memberRoles = await client
    .from("member_roles")
    .select("*")
    .eq("member_id", member.id);
  if (memberRoles.error) {
    throw new Error(memberRoles.error.message);
  }
  memberRolesAgg.push(...memberRoles.data);
}

const sites = await client.from("sites").select("*").eq("team", TEAM_ID);

if (sites.error) {
  throw new Error(sites.error.message);
}

const siteAssetsAgg: {
  id: number;
}[] = [];

for (const site of sites.data) {
  const siteAssets = await client
    .from("assets")
    .select("*")
    .eq("site_id", site.id);
  if (siteAssets.error) {
    throw new Error(siteAssets.error.message);
  }

  console.log(`site ${site.id} has ${siteAssets.data.length} assets`);
  siteAssetsAgg.push(...siteAssets.data);
}

// DELETIONS

for (const siteAsset of siteAssetsAgg) {
  const result = await client.from("assets").delete().eq("id", siteAsset.id);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

for (const site of sites.data) {
  const result = await client.from("sites").delete().eq("id", site.id);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

for (const memberRole of memberRolesAgg) {
  const result = await client
    .from("member_roles")
    .delete()
    .eq("id", memberRole.id);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

for (const member of members.data) {
  const result = await client.from("members").delete().eq("id", member.id);
  if (result.error) {
    throw new Error(result.error.message);
  }
}

const result = await client.from("teams").delete().eq("id", TEAM_ID);

if (result.error) {
  throw new Error(result.error.message);
}

console.log(result.data);
