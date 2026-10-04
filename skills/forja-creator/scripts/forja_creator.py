"""
forja_creator.py — Creació i validació de personatges FORJA RPG
"""
from dataclasses import dataclass, field
from typing import Optional
import math

# ── COSTOS ────────────────────────────────────────────────────────────────────

COST_ATRIBUT = {0:0, 1:0, 2:10, 3:30, 4:60, 5:100}

COST_MIDA = {1:-10, 2:-5, 3:0, 4:10, 5:25}
NOM_MIDA  = {1:"diminuta", 2:"petita", 3:"mitjana", 4:"gran", 5:"enorme"}
MOD_DEF_MIDA = {1:+2, 2:+1, 3:0, 4:-1, 5:-2}

COST_CON  = {1:-5, 2:0, 3:0, 4:10, 5:25}
NOM_CON   = {1:"nyicris", 2:"magra", 3:"saludable", 4:"ferma", 5:"robusta"}

COST_ESPECIE = {
    "humanoide":0, "animal":-15, "artròpode":5, "cefalòpode":25,
    "constructe":10, "incorpori":15, "mecanoide":20, "vegetal":10
}

COST_ARMADURA_NATURAL = {0:0, 1:2, 2:6, 3:12, 4:20, 5:30}

COST_TRETS = {
    "adepte":15, "afortunat":20, "amfibi":10,
    "aparença/agradable":2, "aparença/neutra":0, "aparença/desagradable":-2,
    "aquàtic":5,
    "arrauxat":10, "atribut titànic":30,
    "braços addicionals":5,  # per parell
    "canalitzador":20, "company":0,  # variable
    "contactes":10, "control del qi":20, "coordinació millorada":15,
    "cua":5, "curació ràpida":15,  # per punt
    "dur de pelar":15, "dron":-30, "discapacitat":-5,
    "efímer":-10, "èmpata":20, "encantador":2,
    "especialista":20, "estatus":10, "esguerrat/mà":-5,
    "esguerrat/braç":-15, "esguerrat/cama":-5, "etern":15,
    "familiar":0,  # variable
    "feromones":15, "figaflor":-10, "flexible":5, "foraster":-10,
    "gelatinós":10, "hemofílic":-15, "impediment de la parla":-15,
    "incansable":10, "inepte":-15, "lent":-10, "levitar":15,
    "lingüista natural":15, "longeu":6, "magus":20, "no-mort":20,
    "oracle":30, "poca-traça":-5,
    "potes addicionals":5,   # per parell
    "processador cortical":40, "psíquic":20,
    "recursos/pobre":-10, "recursos/acomodat":25, "recursos/elit":50,
    "reflexos ràpids":30, "regeneració":10, "repulsiu":-2,
    "sentit agut/un":10, "sentit agut/tots":30,
    "sentit atrofiat/borni":-5, "sentit atrofiat/cec":-25,
    "sentit atrofiat/sord":-10, "sentit atrofiat/gust+olfacte":-5,
    "sentit atrofiat/tacte":-5,
    "sentit del perill":20, "sonar":15,
    "tentacles":5,  # per parell
    "visió nocturna":10, "visió perifèrica":15, "volador":25,
    # armament natural
    "armament natural/urpes":5, "armament natural/mossegada":5,
    "armament natural/bec":5, "armament natural/banyes":10,
    "armament natural/pinces":10, "armament natural/fiblons":5,
    # addicció
    "addicció/lleu":-2, "addicció/moderada":-5, "addicció/severa":-10,
    # al·lèrgia
    "al·lèrgia/lleu":-2, "al·lèrgia/moderada":-5, "al·lèrgia/severa":-10,
}

INCOMPATIBLES = [
    ("dur de pelar", "figaflor"),
    ("dur de pelar", "hemofílic"),
    ("curació ràpida", "hemofílic"),
    ("regeneració", "hemofílic"),
    ("etern", "efímer"),
    ("etern", "longeu"),
    ("efímer", "longeu"),
    ("encantador", "repulsiu"),
    ("flexible", "poca-traça"),
    ("coordinació millorada", "poca-traça"),
    ("incansable", "figaflor"),
    ("lent", "reflexos ràpids"),
    ("sonar", "sentit atrofiat/sord"),
    ("feromones", "sentit atrofiat/gust+olfacte"),
    ("visió nocturna", "sentit atrofiat/cec"),
    ("visió perifèrica", "sentit atrofiat/borni"),
]

TRETS_SOBRENATURALS = {"magus","psíquic","control del qi","canalitzador","oracle"}

HABILITATS_RESTRINGIDES = {"canalització","màgia","psi","qi"}

# ── CLASSE PRINCIPAL ──────────────────────────────────────────────────────────

@dataclass
class PersonatgeFORJA:
    nom: str
    tipus: str = "PNJ"          # PJ / PNJ / Animal / Criatura

    # Atributs primaris
    FOR: int = 2
    DES: int = 2
    AGI: int = 2
    PER: int = 2
    INT: int = 2
    APL: int = 2

    # Atributs secundaris d'elecció
    especie: str = "humanoide"
    constitucio: int = 3
    mida: int = 3

    # Habilitats {nom_lower: nivell}
    habilitats: dict = field(default_factory=dict)

    # Trets [str] — usar noms normalitzats de COST_TRETS
    trets: list = field(default_factory=list)

    # Armadura natural (nivell 0-5)
    armadura_natural: int = 0

    # Artefactes {nom: cost_pc}
    artefactes: dict = field(default_factory=dict)

    # Text descriptiu
    descripcio: str = ""

    # ── Càlculs automàtics ──

    @property
    def latencia(self) -> int:
        return 10 + self.mida - (self.AGI * 2)

    @property
    def defensa(self) -> int:
        return self.AGI + MOD_DEF_MIDA.get(self.mida, 0)

    @property
    def reduccio_dany(self) -> int:
        return self.FOR

    @property
    def reaccio(self) -> int:
        trets_lower = [t.lower() for t in self.trets]
        return 2 if any("reflexos ràpids" in t for t in trets_lower) else 1

    @property
    def nom_mida(self) -> str:
        return NOM_MIDA.get(self.mida, "?")

    @property
    def nom_constitucio(self) -> str:
        return NOM_CON.get(self.constitucio, "?")

    # ── Cost total ──

    def cost_atributs(self) -> int:
        total = 0
        for attr in [self.FOR, self.DES, self.AGI, self.PER, self.INT, self.APL]:
            total += COST_ATRIBUT.get(min(attr, 5), 0)
        return total

    def cost_secundaris(self) -> int:
        c = COST_ESPECIE.get(self.especie.lower(), 0)
        c += COST_MIDA.get(self.mida, 0)
        c += COST_CON.get(self.constitucio, 0)
        c += COST_ARMADURA_NATURAL.get(min(self.armadura_natural, 5), 0)
        return c

    def cost_habilitats(self) -> int:
        total = 0
        for hab, nivell in self.habilitats.items():
            if nivell > 0:
                total += nivell * (nivell + 1) // 2
        return total

    def cost_trets_calculat(self) -> int:
        total = 0
        for tret in self.trets:
            t = tret.lower().strip()
            # Cerca clau exacta primer
            if t in COST_TRETS:
                total += COST_TRETS[t]
                continue
            # Cerca parcial (per trets amb /X numèric com "armament natural/urpes")
            trobat = False
            for clau, cost in COST_TRETS.items():
                if t.startswith(clau) or clau.startswith(t.split("/")[0]):
                    if clau in t or t in clau:
                        total += cost
                        trobat = True
                        break
            if not trobat:
                pass  # tret desconegut, no suma
        return total

    def cost_artefactes(self) -> int:
        return sum(self.artefactes.values())

    def cost_total(self) -> int:
        return (self.cost_atributs() + self.cost_secundaris() +
                self.cost_habilitats() + self.cost_trets_calculat() +
                self.cost_artefactes())

    # ── Validació ──

    def valida(self) -> list[str]:
        errors = []
        avisos = []
        trets_lower = [t.lower().strip() for t in self.trets]

        # Incorpori: atributs físics han de ser 0
        if self.especie.lower() == "incorpori":
            for attr_name in ["FOR","DES","AGI"]:
                if getattr(self, attr_name) != 0:
                    errors.append(f"INCORPORI: {attr_name} ha de ser 0")

        # Mecanoide: no pot tenir trets sobrenaturals
        if self.especie.lower() == "mecanoide":
            for ts in TRETS_SOBRENATURALS:
                if any(ts in t for t in trets_lower):
                    errors.append(f"MECANOIDE no pot tenir tret sobrenatural: {ts}")

        # Incompatibilitats
        for (a, b) in INCOMPATIBLES:
            ha = any(a in t for t in trets_lower)
            hb = any(b in t for t in trets_lower)
            if ha and hb:
                errors.append(f"Trets incompatibles: '{a}' i '{b}'")

        # Adepte + Inepte al mateix atribut
        for attr in ["for","des","agi","per","int","apl"]:
            ha_adepte = any(f"adepte/{attr}" in t or
                           (t == "adepte" and attr in self.trets[trets_lower.index(t)] .lower()
                            if t == "adepte" else False)
                           for t in trets_lower)
            ha_inepte = any(f"inepte/{attr}" in t for t in trets_lower)
            if ha_adepte and ha_inepte:
                errors.append(f"ADEPTE i INEPTE al mateix atribut: {attr.upper()}")

        # Habilitats restringides sense nivell 1
        for hab, nivell in self.habilitats.items():
            if hab.lower() in HABILITATS_RESTRINGIDES and nivell < 1:
                errors.append(f"Habilitat restringida '{hab}' necessita nivell ≥1")

        # Nivells d'atribut fora de rang
        for attr_name in ["FOR","DES","AGI","PER","INT","APL"]:
            val = getattr(self, attr_name)
            if not (0 <= val <= 5):
                errors.append(f"{attr_name}={val} fora de rang (0-5)")

        # Mida i constitució fora de rang
        if not (1 <= self.mida <= 5):
            errors.append(f"Mida={self.mida} fora de rang (1-5)")
        if not (1 <= self.constitucio <= 5):
            errors.append(f"Constitució={self.constitucio} fora de rang (1-5)")

        # Avisos de categoria
        cost = self.cost_total()
        if self.tipus.lower() == "figurant" and cost > 60:
            avisos.append(f"AVÍS: cost {cost} PC elevat per un figurant (habitual <60 PC)")
        if self.tipus.lower() in ("pnj","secundari") and cost > 250:
            avisos.append(f"AVÍS: cost {cost} PC molt alt per un PNJ secundari")

        # Curació ràpida sense tret psíquic/màgic (avís, no error)
        if any("curació ràpida" in t for t in trets_lower) and \
           not any(t in ["mecanoide"] for t in [self.especie.lower()]) and \
           not any(ts in " ".join(trets_lower) for ts in ["regeneració","no-mort"]):
            avisos.append("AVÍS: CURACIÓ RÀPIDA sense explicació narrativa (sobrenatural / mecanoide)")

        return errors + avisos

    # ── Formatació de fitxa ──

    def fitxa(self) -> str:
        cost = self.cost_total()

        # Capçalera
        lines = [
            f"{self.nom}",
            f"{self.tipus} de cost {cost} PC.",
            f"Atributs primaris: FOR {self.FOR}, DES {self.DES}, AGI {self.AGI}, "
            f"PER {self.PER}, INT {self.INT}, APL {self.APL}.",
            f"Atributs secundaris: {self.especie.capitalize()}. "
            f"Constitució {self.nom_constitucio} ({self.constitucio}), "
            f"mida {self.nom_mida} ({self.mida}), "
            f"latència {self.latencia}, defensa {self.defensa}, "
            f"reducció de dany {self.reduccio_dany}, reacció {self.reaccio}.",
        ]

        # Habilitats (ordre alfabètic)
        if self.habilitats:
            hab_str = ", ".join(
                f"{h} {n}" for h, n in sorted(self.habilitats.items())
                if n > 0
            )
            lines.append(f"Habilitats: {hab_str}")

        # Trets
        if self.trets:
            lines.append(f"Trets: {', '.join(self.trets)}.")

        # Artefactes
        if self.artefactes:
            art_str = ", ".join(
                f"{n} ({c} PC)" for n, c in self.artefactes.items()
            )
            lines.append(f"Artefactes i efectes: {art_str}.")

        # Descripció
        if self.descripcio:
            lines.append(f"{self.descripcio}")

        return "\n".join(lines)

    def fitxa_amb_validacio(self) -> str:
        errors = self.valida()
        fitxa = self.fitxa()

        if errors:
            err_str = "\n".join(f"  ⚠ {e}" for e in errors)
            return f"{fitxa}\n\n--- VALIDACIÓ ---\n{err_str}"
        else:
            return f"{fitxa}\n\n--- VALIDACIÓ: OK ✓ ---"

    def desglos_cost(self) -> str:
        lines = [
            f"Desglos cost ({self.nom}):",
            f"  Atributs primaris:  {self.cost_atributs()} PC",
            f"  Espècie+mida+con:   {self.cost_secundaris()} PC",
            f"  Habilitats:         {self.cost_habilitats()} PC",
            f"  Trets:              {self.cost_trets_calculat()} PC",
            f"  Artefactes:         {self.cost_artefactes()} PC",
            f"  TOTAL:              {self.cost_total()} PC",
        ]
        return "\n".join(lines)


# ── HELPERS ───────────────────────────────────────────────────────────────────

def valida_pnj_existent(nom, tipus, for_, des, agi, per_, int_, apl,
                         especie, constitucio, mida,
                         habilitats, trets,
                         armadura_natural=0, artefactes=None,
                         cost_declarat=None) -> str:
    """Valida un PNJ ja existent i comprova si el cost declarat és correcte."""
    p = PersonatgeFORJA(
        nom=nom, tipus=tipus,
        FOR=for_, DES=des, AGI=agi, PER=per_, INT=int_, APL=apl,
        especie=especie, constitucio=constitucio, mida=mida,
        habilitats=habilitats, trets=trets,
        armadura_natural=armadura_natural,
        artefactes=artefactes or {}
    )
    result = p.fitxa_amb_validacio() + "\n" + p.desglos_cost()
    if cost_declarat is not None:
        calculat = p.cost_total()
        if calculat != cost_declarat:
            result += f"\n  ⚠ Cost declarat al manual: {cost_declarat} PC — calculat: {calculat} PC (diferència: {calculat-cost_declarat:+d})"
        else:
            result += f"\n  ✓ Cost declarat coincideix: {cost_declarat} PC"
    return result


# ── TEST / DEMO ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== CREACIÓ: Aràcnid Territorial ===\n")
    aracnid = PersonatgeFORJA(
        nom="Aràcnid Territorial",
        tipus="Criatura",
        FOR=3, DES=2, AGI=2, PER=2, INT=1, APL=1,
        especie="artròpode",
        constitucio=3, mida=4,
        habilitats={
            "barallar-se": 4,
            "cercar": 2,
            "consciència": 3,
            "córrer": 2,
            "esquivar": 2,
            "resistència": 3,
        },
        trets=["Armament natural/mossegada", "Armament natural/urpes",
               "Armadura natural/2", "Potes addicionals/2",
               "Sentit agut/tots", "Visió nocturna"],
        armadura_natural=2,
        descripcio="Aràcnids d'entre 1.5 i 2 metres, territorials i agressius quan se'ls envaeix el terreny. "
                   "Les seves potes addicionals els fan especialment estables i ràpids en terrenys irregulars."
    )
    print(aracnid.fitxa_amb_validacio())
    print()
    print(aracnid.desglos_cost())

    print("\n\n=== VALIDACIÓ PNJ EXISTENT: Gat ===\n")
    resultat = valida_pnj_existent(
        nom="Gat", tipus="Animal",
        for_=1, des=1, agi=3, per_=1, int_=1, apl=1,
        especie="animal", constitucio=3, mida=1,
        habilitats={"acrobàcies":3,"amagar-se":3,"barallar-se":2,
                    "cercar":1,"consciència":2,"córrer":3,"esquivar":3},
        trets=["Armament natural/urpes","Efímer","Visió nocturna"],
        cost_declarat=21
    )
    print(resultat)

    print("\n\n=== ERROR DETECTAT: Mecanoide sobrenatural ===\n")
    mal = PersonatgeFORJA(
        nom="Androide Màgic",
        tipus="PNJ",
        FOR=2, DES=3, AGI=2, PER=2, INT=2, APL=2,
        especie="mecanoide",
        constitucio=3, mida=3,
        habilitats={"màgia":3},
        trets=["Magus","Dur de pelar","Figaflor"]
    )
    print(mal.fitxa_amb_validacio())
