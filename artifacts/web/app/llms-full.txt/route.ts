import { LLMS_SUCCESS_HEADERS, llmsUnavailable, loadLlmsInput } from "../../lib/llms-sources";
import { buildLlmsFullTxt } from "../../lib/llms-txt";

export async function GET() {
  const input = await loadLlmsInput();
  if (!input) return llmsUnavailable();
  return new Response(buildLlmsFullTxt(input), { headers: LLMS_SUCCESS_HEADERS });
}
