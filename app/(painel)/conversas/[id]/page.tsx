import { TelaConversas } from "@/components/telas/conversas";

export const metadata = { title: "Conversa" };

export default async function Pagina({ params }: PageProps<"/conversas/[id]">) {
  const { id } = await params;
  return <TelaConversas idAberta={id} />;
}
