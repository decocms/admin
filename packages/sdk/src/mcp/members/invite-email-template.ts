interface InviteEmailTemplateProps {
  cleanInviter: string;
  cleanTeamName: string;
  formattedRoles: string;
}

export function getInviteEmailTemplate({ cleanInviter, cleanTeamName, formattedRoles }: InviteEmailTemplateProps): string {
  return `
<!doctype html>
<html lang="en" dir="auto" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<title>Team invitation</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style type="text/css">

#outlook a { padding:0; }
body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
p { display:block;margin:13px 0; }
</style>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<!--[if lte mso 11]>
<style type="text/css">

.h { width:100% !important; }
</style>
<![endif]-->
<style type="text/css">

@media only screen and (min-width:599px) {
.k { width:536px !important; max-width: 536px; }
.o { width:100% !important; max-width: 100%; }
.p { width:568px !important; max-width: 568px; }
.q { width:488px !important; max-width: 488px; }
}
</style>
<style media="screen and (min-width:599px)">
.moz-text-html .k { width:536px !important; max-width: 536px; }
.moz-text-html .o { width:100% !important; max-width: 100%; }
.moz-text-html .p { width:568px !important; max-width: 568px; }
.moz-text-html .q { width:488px !important; max-width: 488px; }
</style>
<style type="text/css">

@media only screen and (max-width:598px) {
table.mq { width: 100% !important; }
td.mq { width: auto !important; }
}
noinput.mn-checkbox { display:block!important; max-height:none!important; visibility:visible!important; }
</style>
<style type="text/css">

body {
-webkit-font-smoothing:antialiased;
-moz-osx-font-smoothing:grayscale;
}
a[x-apple-data-detectors] {
color: inherit !important;
text-decoration: none !important;
}
u + .emailify a {
color: inherit !important;
text-decoration: none!important;
}
#MessageViewBody a {
color: inherit !important;
text-decoration: none!important;
}
@media only screen and (max-width:599px) {
.emailify { height:100% !important; margin:0 !important; padding:0 !important; width:100% !important; }
td.x { padding-left: 0!important; padding-right: 0!important; }
.mq img { width: 100%!important; max-width: 100%!important; height: auto!important; }
td.b td { background-size: cover!important; }
div.r > table > tbody > tr > td { direction: ltr!important; }
img { background-color: transparent!important; }
div.w.e > table > tbody > tr > td, div.w.e > div > table > tbody > tr > td { padding-right:16px!important; }
div.w.y > table > tbody > tr > td, div.w.y > div > table > tbody > tr > td { padding-left:16px!important; }
div.r.e > table > tbody > tr > td, div.r.e > div > table > tbody > tr > td { padding-right:16px!important }
div.r.y > table > tbody > tr > td, div.r.y > div > table > tbody > tr > td { padding-left:16px!important }
div.r.pt-0 > table > tbody > tr > td, div.r.pt-0 > div > table > tbody > tr > td { padding-top:0px!important }
div.r.pr-0 > table > tbody > tr > td, div.r.pr-0 > div > table > tbody > tr > td { padding-right:0px!important }
div.r.pb-0 > table > tbody > tr > td, div.r.pb-0 > div > table > tbody > tr > td { padding-bottom:0px!important }
div.r.pl-0 > table > tbody > tr > td, div.r.pl-0 > div > table > tbody > tr > td { padding-left:0px!important }
td.b.xb > table { width:100%!important } td.xb > table > tbody > tr > td > a { display: block!important; width: 100%!important; padding-left: 0!important; padding-right: 0!important; }
td.b.xb > table { width:100%!important } td.xb > table > tbody > tr > td { width: 100%!important; padding-left: 0!important; padding-right: 0!important; }
td.v.c > div.i > a.l.m { padding-right:8px!important; }
}
</style>
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<!--[if gte mso 9]>
<style>
a:link {
mso-style-priority: 99;
color: inherit;
text-decoration: none;
}
a:visited {
mso-style-priority: 99;
color: inherit;
text-decoration: none;
}
li { margin-left: -1em !important }
table, td, p, div, span, ul, ol, li, a, h1, h2, h3, h4, h5, h6 {
mso-hyphenate: none;
}
sup, sub { font-size: 100% !important; }
img { background-color: transparent !important; }
</style>
<![endif]-->
<!--[if mso]>
<style>
.co { background: transparent !important; background-color: transparent !important; mso-padding-alt: 0px; !important; padding: 0px !important; border: 0px !important; border-top: 0px !important; border-right: 0px !important; border-bottom: 0px !important; border-left: 0px !important; }
</style>
<![endif]-->
</head>
<body lang="en" link="#DD0000" vlink="#DD0000" class="emailify" style="mso-line-height-rule: exactly; mso-hyphenate: none; word-spacing: normal; background-color: #e5e5e5;">
<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;"><strong>${cleanInviter}</strong> has invited you to join the team <strong>${cleanTeamName}</strong> as <strong>${formattedRoles}</strong></div>
<div style="background-color:#e5e5e5;" lang="en" dir="auto">
<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600" bgcolor="#f1f0ee" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="w e y" style="background:#f1f0ee;background-color:#f1f0ee;margin:0px auto;max-width:600px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#f1f0ee;background-color:#f1f0ee;width:100%;border-radius:30px;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:16px 16px 16px 16px;text-align:center;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="r e y" style="background:#eff1f1;background-color:#eff1f1;margin:0px auto;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#eff1f1;background-color:#eff1f1;width:100%;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:32px 16px 32px 16px;text-align:left;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;width:536px;" ><![endif]-->
<div class="k h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border:none;vertical-align:middle;" width="100%">
<tbody>
<tr>
<td align="center" style="font-size:0;padding:0;word-break:break-word;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0;">
<tbody>
<tr>
<td style="width:200px;">
<img alt src="https://e.hypermatic.com/a2c697bae8735119d7d3c4babdae6e40.png" style="border:0;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;" width="200" height="auto">
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr><tr><td class width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" class role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div style="margin:0px auto;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
<tbody>
<tr>
<td style="direction:ltr;font-size:0;padding:0;text-align:center;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;width:568px;" ><![endif]-->
<div class="o h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
<tbody>
<tr>
<td style="vertical-align:top;padding:0;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style width="100%">
<tbody>
<tr>
<td style="font-size:0;padding:0;word-break:break-word;" aria-hidden="true">
<div style="height:0;line-height:0;">&#8202;</div>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr><tr><td width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="r pt-0 pr-0 pb-0 pl-0" style="background:#fafaf9;background-color:#fafaf9;margin:0px auto;border-radius:30px 30px 0px 0px;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafaf9;background-color:#fafaf9;width:100%;border-radius:30px 30px 0px 0px;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:0px 0px 8px 0px;text-align:left;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;width:568px;" ><![endif]-->
<div class="p h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border:none;vertical-align:middle;" width="100%">
<tbody>
<tr>
<td align="center" class="xb" style="font-size:0;padding:0;word-break:break-word;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0;" class="mq">
<tbody>
<tr>
<td style="width:568px;" class="mq">
<img alt src="https://e.hypermatic.com/582b1ca7ee65aa85cfcd839fc6039877.png" style="border:0;border-radius:30px 30px 0px 0px;display:block;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;" width="568" height="auto">
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr><tr><td class width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" class role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div style="margin:0px auto;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
<tbody>
<tr>
<td style="direction:ltr;font-size:0;padding:0;text-align:center;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;width:568px;" ><![endif]-->
<div class="o h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
<tbody>
<tr>
<td style="vertical-align:top;padding:0;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style width="100%">
<tbody>
<tr>
<td style="font-size:0;padding:0;word-break:break-word;" aria-hidden="true">
<div style="height:0;line-height:0;">&#8202;</div>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr><tr><td width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="r e y" style="background:#fafaf9;background-color:#fafaf9;margin:0px auto;border-radius:0px 0px 30px 30px;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafaf9;background-color:#fafaf9;width:100%;border-radius:0px 0px 30px 30px;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:8px 40px 40px 40px;text-align:left;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;width:488px;" ><![endif]-->
<div class="q h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border:none;vertical-align:middle;" width="100%">
<tbody>
<tr>
<td align="center" class="x m" style="font-size:0;padding-bottom:24px;word-break:break-word;">
<div style="text-align:center;"><p style="Margin:0;mso-line-height-alt:44px;"><span style="font-size:36px;font-family:'Helvetica', 'Helvetica', sans-serif;font-weight:400;color:#163029;line-height:122%;mso-line-height-alt:44px;">${cleanInviter} has invited you to join the team ${cleanTeamName} as ${formattedRoles}</span></p></div>
</td>
</tr>
<tr>
<td align="center" class="x m" style="font-size:0;padding-bottom:24px;word-break:break-word;">
<div style="text-align:center;"><p style="Margin:0;mso-line-height-alt:21px;"><span style="font-size:14px;font-family:'Helvetica', 'Helvetica', sans-serif;font-weight:400;color:#78726e;line-height:150%;mso-line-height-alt:21px;">Gain control and visibility over all AI use in your company. Replace your complex stack with deco.chat, your open-source AI platform.</span></p></div>
</td>
</tr>
<tr>
<td align="center" class="b xb" style="font-size:0;padding:0;padding-bottom:0;word-break:break-word;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;width:155px;line-height:100%;">
<tbody>
<tr>
<td align="center" bgcolor="#d0ec1a" class="co" role="presentation" style="background:#d0ec1a;border:none;border-radius:16px 16px 16px 16px;cursor:auto;mso-padding-alt:18px 0px 18px 0px;vertical-align:middle;" valign="middle">
<!--[if mso]><v:roundrect style="width:155px;height:54px;v-text-anchor:middle;" arcsize="59%" fill="t" stroke="f" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"><w:anchorlock/><v:fill type="solid" color="#d0ec1a" /><v:textbox inset="0,0,0,0"><center><![endif]-->
<a href="https://deco.chat/invites" class="co" style="display:inline-block;width:155px;background-color:#d0ec1a;color:#ffffff;font-family:'Helvetica', 'Helvetica', sans-serif;font-size:13px;font-weight:normal;line-height:100%;margin:0;text-decoration:none;text-transform:none;padding:18px 0px 18px 0px;mso-padding-alt:0;border-radius:16px 16px 16px 16px;" target="_blank">
<span style="font-size:16px;font-family:'Helvetica', 'Helvetica', sans-serif;font-weight:400;color:#07401a;line-height:113%;mso-line-height-alt:18px;">Accept invite</span>
</a>
<!--[if mso]></center></v:textbox></v:roundrect><![endif]-->
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600" bgcolor="#eff1f1" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="w e y" style="background:#eff1f1;background-color:#eff1f1;margin:0px auto;max-width:600px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#eff1f1;background-color:#eff1f1;width:100%;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:16px 16px 16px 16px;text-align:center;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td width="600px" ><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:568px;" width="568" ><tr><td style="line-height:0;font-size:0;mso-line-height-rule:exactly;"><![endif]-->
<div class="r e y" style="background:#e7e5e4;background-color:#e7e5e4;margin:0px auto;border-radius:30px 30px 30px 30px;max-width:568px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#e7e5e4;background-color:#e7e5e4;width:100%;border-radius:30px 30px 30px 30px;">
<tbody>
<tr>
<td style="border:none;direction:ltr;font-size:0;padding:40px 40px 40px 40px;text-align:left;">
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;width:488px;" ><![endif]-->
<div class="q h" style="font-size:0;text-align:left;direction:ltr;display:inline-block;vertical-align:middle;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border:none;vertical-align:middle;" width="100%">
<tbody>
<tr>
<td align="center" class="v c" style="font-size:0;word-break:break-word;">
<div class="i" style>
<!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center"><tr><td style="padding:0;padding-top:0;padding-left:0;padding-right:8px;padding-bottom:0;"><![endif]-->
<a class="l m" href="https://deco.chat/about" target="_blank" style="display:inline-block;color:#000000;font-family:'Helvetica', 'Helvetica', sans-serif;font-size:13px;font-weight:normal;line-height:0;text-decoration:none;text-transform:none;padding:0;padding-top:0;padding-left:0;padding-right:8px;padding-bottom:0;">
<span style="font-size:13px;font-family:'Helvetica', 'Helvetica', sans-serif;font-weight:400;color:#000000;line-height:115%;text-decoration:underline;mso-line-height-alt:15px;">About us</span>
</a>
<!--[if mso | IE]></td><td style="padding:0;padding-top:0;padding-left:0;padding-right:0;padding-bottom:0;"><![endif]-->
<a class="l" href="https://deco.chat/about" target="_blank" style="display:inline-block;color:#000000;font-family:'Helvetica', 'Helvetica', sans-serif;font-size:13px;font-weight:normal;line-height:0;text-decoration:none;text-transform:none;padding:0;padding-top:0;padding-left:0;padding-right:0;padding-bottom:0;">
<span style="font-size:13px;font-family:'Helvetica', 'Helvetica', sans-serif;font-weight:400;color:#000000;line-height:115%;mso-line-height-alt:15px;">Made with ❤️ in Brazil</span>
</a>
<!--[if mso | IE]></td></tr></table><![endif]-->
</div>
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table></td></tr></table><![endif]-->
</td>
</tr>
</tbody>
</table>
</div>
<!--[if mso | IE]></td></tr></table><![endif]-->
</div>
</body>
</html>
`;
} 