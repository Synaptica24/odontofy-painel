import { TelaPaciente } from "@/components/telas/paciente";

export const metadata = { title: "Paciente" };

export default async function Pagina({ params }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  return <TelaPaciente id={id} />;
}
