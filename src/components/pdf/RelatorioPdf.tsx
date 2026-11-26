/* Relatório "Análise do FUNDEB" em PDF — montado só a partir do snapshot. Importe dinamicamente (navegador). */
import { Document, Image, Line, Page, Path, Rect, StyleSheet, Svg, Text, View, pdf, Polyline } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { brl, decimal, inteiro, mi, pctVar, variacao } from "@/lib/format";

const AZUL = "#3F51B5", CINZA = "#F3F4F6", VERDE = "#2E7D32", VERM = "#C62828", TXT = "#1F2937", MUT = "#6B7280";
const st = StyleSheet.create({
  page: { paddingTop: 92, paddingBottom: 78, paddingHorizontal: 32, fontSize: 9, color: TXT, fontFamily: "Helvetica" },
  header: { position: "absolute", top: 20, left: 32, right: 32, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: AZUL, paddingBottom: 8 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", alignItems: "center", borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 6 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", color: AZUL, marginBottom: 6, marginTop: 4 },
  p: { fontSize: 8.5, color: MUT, marginBottom: 8, lineHeight: 1.4 },
  secao: { backgroundColor: CINZA, padding: 10, borderRadius: 4, marginBottom: 12 },
  cards: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { backgroundColor: "#fff", borderLeftWidth: 3, borderLeftColor: AZUL, padding: 7, width: "23.5%" },
  cardR: { fontSize: 6.5, color: MUT, textTransform: "uppercase", marginBottom: 3 },
  cardV: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  th: { backgroundColor: AZUL, color: "#fff", fontFamily: "Helvetica-Bold", fontSize: 7, padding: 3 },
  td: { fontSize: 7, padding: 3, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
});
const Selo = ({ v }: { v: number }) => <Text style={{ fontSize: 6.5, color: v > 0.00005 ? VERDE : v < -0.00005 ? VERM : MUT }}>{pctVar(v)}</Text>;
const Card = ({ r, v, s, w }: { r: string; v: string; s?: any; w?: string }) => (
  <View style={[st.card, w ? { width: w } : {}]}><Text style={st.cardR}>{r}</Text><Text style={st.cardV}>{v}</Text>{s}</View>
);
function Tabela({ cols, rows, widths, total }: { cols: string[]; rows: any[][]; widths: number[]; total?: any[] }) {
  return (
    <View>
      <View style={{ flexDirection: "row" }} fixed>{cols.map((c, i) => <Text key={i} style={[st.th, { width: `${widths[i]}%` }]}>{c}</Text>)}</View>
      {rows.map((r, i) => <View key={i} style={{ flexDirection: "row" }} wrap={false}>{r.map((c, j) => <View key={j} style={[st.td, { width: `${widths[j]}%` }]}>{typeof c === "object" ? c : <Text>{String(c ?? "")}</Text>}</View>)}</View>)}
      {total && <View style={{ flexDirection: "row" }}>{total.map((c, j) => <Text key={j} style={[st.td, { width: `${widths[j]}%`, fontFamily: "Helvetica-Bold" }]}>{c}</Text>)}</View>}
    </View>
  );
}
function GraficoLinhas({ receitas }: { receitas: any[] }) {
  const W = 520, H = 170, pad = 30;
  const max = Math.max(1, ...receitas.map((r) => r.total));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(1, receitas.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const linhas: [string, string, boolean][] = [["total", TXT, false], ["contribuicao", AZUL, true], ["vaaf", "#0097A7", true], ["vaat", VERDE, true], ["vaar", "#F9A825", true]];
  return (
    <Svg width={W} height={H}>
      <Line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#999" strokeWidth={0.5} />
      {linhas.map(([k, c, d]) => <Polyline key={k} points={receitas.map((r, i) => `${x(i)},${y(r[k])}`).join(" ")} stroke={c} strokeWidth={d ? 1.2 : 2.2} fill="none" {...(d ? { strokeDasharray: "4,3" } : {})} />)}
      {receitas.map((r, i) => <Text key={i} x={x(i) - 8} y={H - 14} style={{ fontSize: 7 }}>{String(r.ano)}</Text>)}
      {linhas.map(([k, c]) => { const l = receitas[receitas.length - 1]; return l ? <Text key={k} x={x(receitas.length - 1) - 40} y={y(l[k]) - 3} style={{ fontSize: 6, color: c }} fill={c}>{mi(l[k])}</Text> : null; })}
    </Svg>
  );
}
function GraficoBarras({ P }: { P: any }) {
  const W = 520, H = 170, comps = ["total", "contribuicao", "vaaf", "vaat", "vaar"], nomes = ["Total", "Contribuição", "VAAF", "VAAT", "VAAR"];
  const max = Math.max(1, P.otimista.total), gw = (W - 20) / comps.length, bw = gw / 4;
  return (
    <Svg width={W} height={H}>
      {comps.map((k, i) => (["conservador", "base", "otimista"] as const).map((c, j) => {
        const h = (P[c][k] / max) * (H - 40);
        return <Rect key={k + c} x={10 + i * gw + j * bw + bw / 2} y={H - 20 - h} width={bw - 2} height={h} fill={[VERM, AZUL, VERDE][j]!} />;
      }))}
      {nomes.map((n, i) => <Text key={n} x={10 + i * gw + bw} y={H - 6} style={{ fontSize: 7 }}>{n}</Text>)}
    </Svg>
  );
}

export function RelatorioDoc({ snap, qr, brasao }: { snap: any; qr: string; brasao: string }) {
  const A = snap.analise, m = A.municipio, c = A.cards, ra = A.receita_atual || {}, rp = A.receita_anterior, P = A.projecao, pot = A.potencial;
  const link = `${(snap.url_publica || "").replace(/\/$/, "")}/verify/${snap.codigo}`;
  const anexos: [string, string, string, boolean][] = [
    ["URBANA_EM_ESCOLA_RURAL", "Anexo I — Residência urbana em escola rural", "Alunos com zona de residência urbana e vínculo em escola de localização rural.", false],
    ["DEFICIENCIA_SEM_AEE", "Anexo II — Deficiência sem vínculo de AEE", "Alunos com deficiência/TEA informada e nenhum vínculo de AEE no município.", true],
    ["AEE_SEM_CURRICULAR", "Anexo III — AEE sem matrícula curricular", "Alunos com vínculo de AEE e nenhuma matrícula curricular no município.", false],
    ["MAIS_DE_UM_VINCULO_AEE", "Anexo IV — Mais de um vínculo de AEE", "Critério em validação: 2+ matrículas de AEE ou AEE no mesmo horário da turma curricular.", false],
  ];
  const nomesInc: Record<string, string> = { MAIS_DE_UM_VINCULO_AEE: "Mais de um vínculo de AEE", AEE_SEM_CURRICULAR: "AEE sem matrícula curricular", URBANA_EM_ESCOLA_RURAL: "Residência urbana em escola rural", DEFICIENCIA_SEM_AEE: "Deficiência sem vínculo de AEE" };
  const comp: [string, string][] = [["total", "Total"], ["contribuicao", "Contribuição"], ["vaaf", "VAAF"], ["vaat", "VAAT"], ["vaar", "VAAR"]];
  const v = (a: number, b?: number) => (b ? variacao(a, b) : 0);
  const tabRows: any[][] = [];
  A.tabela.grupos.forEach((g: any) => {
    tabRows.push([<Text style={{ fontFamily: "Helvetica-Bold" }}>{g.nome}</Text>, "", inteiro(g.totais.ant.matriculas), inteiro(g.totais.atual.matriculas), inteiro(g.totais.ant.vaaf), inteiro(g.totais.atual.vaaf), inteiro(g.totais.ant.vaat), inteiro(g.totais.atual.vaat)]);
    g.linhas.forEach((l: any) => tabRows.push(["   " + l.subcategoria, decimal(l.peso, 4), inteiro(l.ant.matriculas), <View><Text>{inteiro(l.atual.matriculas)}</Text><Selo v={v(l.atual.matriculas, l.ant.matriculas)} /></View>, inteiro(l.ant.vaaf), <View><Text>{inteiro(l.atual.vaaf)}</Text><Selo v={v(l.atual.vaaf, l.ant.vaaf)} /></View>, inteiro(l.ant.vaat), <View><Text>{inteiro(l.atual.vaat)}</Text><Selo v={v(l.atual.vaat, l.ant.vaat)} /></View>]));
  });
  const T = A.tabela.total;
  return (
    <Document title={`Análise do FUNDEB - ${m.nome} ${A.ano}`}>
      <Page size="A4" style={st.page}>
        <View style={st.header} fixed>
          {brasao ? <Image src={brasao} style={{ width: 44, height: 44, marginRight: 10 }} /> : <View style={{ width: 44, height: 44, marginRight: 10, backgroundColor: CINZA }} />}
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>PREFEITURA MUNICIPAL DE {String(m.nome).toUpperCase()} - {m.uf}</Text>
            <Text style={{ fontSize: 8 }}>{m.orgao || "Fundo Municipal de Educação"}</Text>
            {m.cnpj ? <Text style={{ fontSize: 8 }}>CNPJ: {m.cnpj}</Text> : null}
            <Text style={{ fontSize: 9, color: AZUL, fontFamily: "Helvetica-Bold" }}>ANÁLISE DO FUNDEB</Text>
          </View>
        </View>
        <View style={st.footer} fixed>
          <Image src={qr} style={{ width: 46, height: 46, marginRight: 8 }} />
          <Text style={{ flex: 1, fontSize: 6.5, color: MUT }}>Documento gerado eletronicamente por {snap.emitente}{snap.emitente_cnpj ? ` (CNPJ ${snap.emitente_cnpj})` : ""} em {snap.emitido_em} horário oficial de Brasília. A autenticidade deste documento pode ser conferida no link {link} realizando a leitura do QR Code ao lado.</Text>
          <Text style={{ fontSize: 8, marginLeft: 8 }} render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`} />
        </View>

        <Text style={st.h1}>Resumo do relatório</Text>
        <View style={[st.secao, st.cards]}>
          <Card r={`Receita FUNDEB ${A.ano}`} v={brl(ra.total)} s={rp ? <Selo v={v(ra.total, rp.total)} /> : null} />
          <Card r={`Matrículas FUNDEB ${A.ano}`} v={inteiro(c.matriculas_fundeb)} s={A.matriculas_fundeb_anterior ? <Selo v={v(c.matriculas_fundeb, A.matriculas_fundeb_anterior)} /> : null} />
          <Card r="Potencial" v={pot ? pot.classificacao : "-"} s={pot ? <Text style={{ fontSize: 6.5 }}>{pctVar(pot.pct_avancar)} para avançar.</Text> : null} />
          <Card r={`Projeção FUNDEB ${A.ano + 1}`} v={brl(P?.base.total)} s={P ? <Selo v={P.variacoes.base.total} /> : null} />
        </View>
        <Text style={st.h1}>Caracterização do município</Text>
        <View style={[st.secao, st.cards]}>
          <Card r="Total de escolas" v={inteiro(c.total_escolas)} /><Card r="Total de alunos" v={inteiro(c.total_alunos)} /><Card r="População" v={inteiro(m.populacao)} /><Card r="Domicílios" v={inteiro(m.domicilios)} />
          <Card r="Área territorial (km²)" v={decimal(m.area_km2)} /><Card r="Alfabetização" v={`${decimal(m.alfabetizacao_pct)}%`} /><Card r="Pop. indígena" v={inteiro(m.pop_indigena)} /><Card r="Pop. quilombola" v={inteiro(m.pop_quilombola)} />
        </View>
        <Text style={st.h1}>Histórico de receitas do FUNDEB</Text>
        <Text style={st.p}>Total (linha cheia) e Receitas de Contribuição, Complementação VAAF, VAAT e VAAR (linhas tracejadas).</Text>
        <View style={st.secao} wrap={false}>{A.receitas.length ? <GraficoLinhas receitas={A.receitas} /> : <Text>Sem receitas cadastradas.</Text>}</View>
        <Text style={st.h1}>Receitas do FUNDEB para o ano de {A.ano}</Text>
        <View style={[st.secao, st.cards]}>{comp.map(([k, n]) => <Card key={k} w="18.8%" r={n} v={brl(ra[k])} s={rp ? <Selo v={v(ra[k], rp[k])} /> : null} />)}</View>

        <Text style={st.h1} break>Evolução de matrículas e ponderações</Text>
        <Text style={st.p}>Fatores de ponderação conforme a Resolução CIF nº 5, de 26 de julho de 2024.</Text>
        <Tabela cols={["Categoria", "Peso", "Matríc. Ant.", `Matríc. ${A.ano}`, "VAAF Ant.", `VAAF ${A.ano}`, "VAAT Ant.", `VAAT ${A.ano}`]} widths={[34, 8, 9, 10, 9, 10, 9, 11]} rows={tabRows}
          total={["Total geral", "", inteiro(T.ant.matriculas), inteiro(T.atual.matriculas), inteiro(T.ant.vaaf), inteiro(T.atual.vaaf), inteiro(T.ant.vaat), inteiro(T.atual.vaat)]} />

        <Text style={st.h1} break>Residência rural</Text>
        <Text style={st.p}>Escola urbana com 50% ou mais de alunos de residência rural deve ser tratada como Educação do Campo (Decreto 7.352/2010 e Decreto 10.656/2021).</Text>
        <Tabela cols={["Escola", "INEP", "Alunos Urb.", "Alunos Rur.", "Zona", "Área", "Resid. Rural"]} widths={[34, 11, 9, 9, 8, 17, 12]}
          rows={A.escolas.map((e: any) => [e.nome, e.inep, inteiro(e.qtd_urbanos), inteiro(e.qtd_rurais), e.localizacao, e.area, e.residencia_rural === "NA" ? "Não se aplica" : `${e.residencia_rural === "SIM" ? "SIM" : "NÃO"} (${decimal(e.pct_rural * 100, 0)}%)`])} />
        <Text style={st.h1}>Transporte escolar</Text>
        <View style={[st.secao, st.cards]} wrap={false}>
          <Card w="48%" r="Utiliza" v={inteiro(A.transporte.utiliza)} s={<Text style={{ fontSize: 7 }}>{decimal((A.transporte.utiliza / Math.max(1, A.transporte.utiliza + A.transporte.nao_utiliza)) * 100, 1)}%</Text>} />
          <Card w="48%" r="Não utiliza" v={inteiro(A.transporte.nao_utiliza)} s={<Text style={{ fontSize: 7 }}>{decimal((A.transporte.nao_utiliza / Math.max(1, A.transporte.utiliza + A.transporte.nao_utiliza)) * 100, 1)}%</Text>} />
        </View>

        {P && (
          <View break>
            <Text style={st.h1}>Projeção do FUNDEB para {A.ano + 1}</Text>
            <Text style={st.p}>A projeção usa parâmetros oficiais do governo federal (VAAF, VAAT e VAAR), receitas apuradas pela STN/SIAFI, matrículas do Censo Escolar e fatores de ponderação; valores podem mudar conforme atualizações do FNDE/MEC. Conservador (vermelho), Base (azul), Otimista (verde).</Text>
            <View style={st.secao} wrap={false}><GraficoBarras P={P} /></View>
            {(["conservador", "base", "otimista"] as const).map((cn) => (
              <View key={cn} wrap={false}>
                <Text style={[st.h1, { fontSize: 10 }]}>CENÁRIO {cn.toUpperCase()}</Text>
                <View style={[st.secao, st.cards]}>{comp.map(([k, n]) => <Card key={k} w="18.8%" r={n} v={brl(P[cn][k])} s={<Selo v={P.variacoes[cn][k]} />} />)}</View>
              </View>
            ))}
          </View>
        )}
        {pot && (
          <View wrap={false}>
            <Text style={st.h1}>Potencial de crescimento das receitas do FUNDEB</Text>
            <Svg width={520} height={30}>
              <Rect x={0} y={10} width={173} height={10} fill={VERM} /><Rect x={173} y={10} width={173} height={10} fill="#F9A825" /><Rect x={346} y={10} width={174} height={10} fill={VERDE} />
              {(() => { const mx = Math.max(pot.valor, pot.atual, pot.referencial) * 1.08 || 1; const X = (n: number) => (n / mx) * 520; return (<>
                <Line x1={X(pot.referencial)} y1={2} x2={X(pot.referencial)} y2={28} stroke={TXT} strokeDasharray="2,2" />
                <Path d={`M ${X(pot.atual) - 4} 15 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`} fill={TXT} />
                <Line x1={X(pot.valor)} y1={2} x2={X(pot.valor)} y2={28} stroke={TXT} strokeDasharray="1,2" /></>); })()}
            </Svg>
            <View style={[st.secao, st.cards, { marginTop: 6 }]}>
              <Card w="31.5%" r="Referencial" v={brl(pot.referencial)} /><Card w="31.5%" r={`${m.nome} - ${m.uf}`} v={brl(pot.atual)} /><Card w="31.5%" r={`Potencial (${pot.classificacao})`} v={brl(pot.valor)} s={<Text style={{ fontSize: 6.5 }}>{pctVar(pot.pct_avancar)} para avançar.</Text>} />
            </View>
          </View>
        )}
        {A.plano && (
          <View break>
            <Text style={st.h1}>Plano de ação</Text>
            <Tabela cols={["Ação", "Impacto na Receita Prevista", "Impacto no Crescimento"]} widths={[64, 20, 16]}
              rows={[["Implementar integralmente as ações previstas neste Plano de Ação.", brl(A.plano.integral.impacto), `${pctVar(A.plano.integral.pp)} p.p.`], ...A.plano.acoes.map((a: any) => [a.descricao, brl(a.impacto), `${pctVar(a.pp)} p.p.`])]} />
            <Text style={[st.p, { marginTop: 6 }]}>Os impactos de cada ação são calculados isoladamente. Como as ações podem interagir entre si, aplicar mais de uma simultaneamente tende a gerar um impacto total diferente da simples soma dos valores acima.</Text>
          </View>
        )}
        <View wrap={false}>
          <Text style={st.h1}>Inconsistências identificadas</Text>
          <Tabela cols={["Inconsistência", "Total de alunos", "Detalhamento"]} widths={[50, 20, 30]}
            rows={anexos.map(([k, t]) => [nomesInc[k], inteiro(A.inconsistencias.abertas[k]), t.split(" — ")[0]])} />
        </View>
        {anexos.map(([k, t, d, def]) => {
          const rows = (snap.anexos || []).filter((x: any) => x.tipo === k);
          return (
            <View key={k} break>
              <Text style={st.h1}>{t}</Text>
              <Text style={st.p}>{d}</Text>
              <Tabela cols={["Aluno", "INEP", "Nascimento", "CPF", "Escola(s)", "Turma(s)", ...(def ? ["Deficiências"] : [])]} widths={def ? [20, 11, 9, 11, 19, 16, 14] : [24, 12, 10, 12, 22, 20]}
                rows={rows.map((r: any) => [r.aluno, r.inep, r.nascimento, r.cpf, r.escolas, r.turmas, ...(def ? [r.deficiencias] : [])])} total={["Total", String(rows.length), "", "", "", "", ...(def ? [""] : [])]} />
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

async function paraDataUrl(url: string) {
  try {
    const b = await (await fetch(url)).blob();
    return await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
  } catch { return ""; }
}

export async function gerarPdf(snap: any, brasaoUrl: string): Promise<Blob> {
  const base = (snap.url_publica || window.location.origin).replace(/\/$/, "");
  snap = { ...snap, url_publica: base };
  const qr = await QRCode.toDataURL(`${base}/verify/${snap.codigo}`, { margin: 0, width: 200 });
  const brasao = brasaoUrl ? await paraDataUrl(brasaoUrl) : "";
  return pdf(<RelatorioDoc snap={snap} qr={qr} brasao={brasao} />).toBlob();
}
