# SF-068 — auditresultaat, 15 oktober 2026

Onderzochte versie: **0.126.6**, broncommit `1a2e3a5714a82bb3b84f320a03cd432a79b2fa33`.

De auditronde is afgerond met open bevindingen. Dit is geen verklaring dat alle spelprocessen foutloos zijn. Reparaties blijven onder SF-068 geregistreerd. Dit document vervangt de verouderde statusoverzichten in SF068-CURRENT-AUDIT.md; dat bestand blijft historische onderbouwing.

## Actuele open bevindingen

| ID | Prioriteit | Bevinding en gevolg | Bewijs |
|---|---|---|---|
| SOC01 | P1 | Uitgestelde Alliance Fund-donaties zijn geblokkeerd zodra het fonds centrale afrekening gebruikt. De centrale donatieafhandeling ontbreekt. Er worden bij de blokkade geen resources afgeschreven. | Werkelijke `donateAllianceFund` uitgevoerd in geïsoleerde game; bericht en ongewijzigde saldi vastgelegd. |
| SOC02 | P1 | Exile-voorstellen en ministergoedkeuringen blijven lokaal. Twee spelers kunnen zo geen gedeelde stemming afronden. | Centrale galaxy-development API geeft bij `action: exile` 400 `Unknown action`; lokale voorstel/goedkeuringscode onderzocht. |
| SOC07 | P1 | Alliantie-structuren kunnen niet uit een centraal afgerekend fonds worden gebouwd. De bestaande stronghold-claim/slotbeveiliging vervangt geen centrale betaling. | Werkelijke `queueAllianceStructure` met geladen inkomensbasis uitgevoerd; expliciete blokkade, saldi ongewijzigd. |
| L03 | P2 | Politics loopt op 768 px in Classic buiten het kader met een lange planeetnaam zonder spaties. Identity-, policies- en exile-kaarten worden te breed. | Viewport 768 px, document 797 px; kaartrechtsrand 797.33 px. Scrollbare tabellen zijn afzonderlijk beoordeeld en niet als deze fout geteld. |

Herhaal de drie functionele observaties met `node scripts/audit-shared-workflows.cjs`. De uitvoer staat in SF068-SHARED-OBSERVATIONS.json. Deze diagnostiek registreert ontbrekende functionaliteit, geen geslaagde acceptatietests voor die functionaliteit.

## Verificatie

- Volledige huidige regressiesuite: **577 geslaagd, 0 gefaald, 0 overgeslagen**.
- De tien oorspronkelijke onafhankelijke economie-, scan- en governance-reproducties: **0 opnieuw waargenomen fouten**. Uitgevoerd met `node scripts/audit-game-manual.cjs`.
- Population surplus: echte Worker met tijdelijke SQLite-database, **240 ticks**, nul Biodomes, nul gewone levy, volle huisvesting, fractionele groei, 6 Metal / 4 Crystal / 2 Eonium per conversie en herhaalde berichten zonder dubbele storting. Deze test is onderdeel van de 577, geen extra testtelling.
- Havoc: serverlevering en eigenaarbevestiging, weigering van oude koloniesnapshots en eenmaal toepassen opnieuw geslaagd. Dit is geïsoleerde regressiedekking; geen nieuwe Havoc-uitdeling in de live ronde.
- Alliance Fund: samenvoegen van overlappende synchronisaties, verversen na conflict en begrensde retry opnieuw geslaagd. Geen echte spelershandel uitgevoerd.
- Vloten en shipyards: bestaande tests voor bouw/levering/verkoop, herkomst van Alliance Ships, gevechtsverlies, terugkeer en conflicten met reset/readiness opnieuw geslaagd.
- Gedeelde processen: bestaande echte Worker-tests voor covert-kosten/effecten, Miday-privacy en delen, forums, support-ticketrechten, accountrollen, herstel en tick-/resetgeneraties opnieuw geslaagd.
- Browser: **49 actuele schermcontroles**, geen geregistreerde browserfouten. 19 schermen bij 1280 px in Neutral; 15 schermen bij zowel 768 als 390 px in Classic met `VeryLongPlanetNameWithoutSpaces`. Alleen Politics bij 768 px had documentoverloop. Ruwe geometrie: SF068-FINAL-LAYOUT.json.

## Grenzen en vervolgstappen

Er zijn geen live reset, gevechten, transacties of veranderingen aan accounts uitgevoerd. De browsercontroles gebruikten een tijdelijke lokale database. De complete combinatie van alle thema's, rechten, historische data en gelijktijdige spelers is niet uitputtend getest. De eerdere 144 layoutgevallen zijn historische dekking en worden niet bij de 49 actuele gevallen opgeteld. De historische documentatieverschillen zijn in deze eindronde niet opnieuw volledig tegen ieder handleidinghoofdstuk vergeleken.

Reparatievolgorde: centrale donaties en structuurbetalingen; gedeelde exile-stemming; Politics-layout. SF-133 (Universe-herontwerp naar het aangeleverde voorbeeld, inclusief bevolking) is apart geregistreerd en komt na deze auditronde. Auditonderzoek afgerond betekent niet dat deze reparaties al live staan.

## Reparaties — v0.126.7

De vier hierboven beschreven bevindingen zijn nu gerepareerd en lokaal geverifieerd. Het historische overzicht blijft behouden; dit onderdeel bevat de nieuwste status.

- SOC01: centrale donatieorders met eenmaal afschrijven, acht ticks wachttijd, rangcontrole en een persoonlijk maximum van twee ticks gerapporteerd inkomen per resource in 24 uur. Oude legacy-donaties zonder duurzaam order-ID blijven bewaard; zij worden niet blind opnieuw afgerekend.
- SOC02: gedeelde voorstellen, twee verschillende actuele ministeraccounts, één Galaxy Fund-betaling, bescherming tegen gewijzigde ronde of geresette/verplaatste doelen en atomische opslag.
- SOC07: centrale structuurbetaling met uitsluitend gewone tax als prijsbasis, gereserveerd slot, drie ticks bouwtijd, gedeelde effecten/verval en eenmaal toegepaste gebouwtoekenningen aan leden. Donaties en omkoping tellen niet mee in de prijsbasis.
- L03: Politics-kolommen en invoervelden kunnen krimpen; de oorspronkelijke lange-naamreproductie op 768 px is opnieuw getest. Documentbreedte 753 px, kaarten binnen de beschikbare breedte.

Verificatie: 588 tests geslaagd, 0 gefaald; 122 pagina's en 3714 interne verwijzingen zonder ontbrekende doelen. Nieuwe tests controleren dubbele aanvragen, conflicterende aanvragen, rangrechten, treasury rollback, acht-/drie-tick-afhandeling, expiratie, gebouwaantallen en gedeelde ministerstemmen. Lokale browserdonatie: 9000 → 8900 Metal, fonds blijft 18000 totdat T9 arriveert, precies één pending ontvangst van 100 Metal. Geen live speltransactie of reset uitgevoerd. De brede dekkingsgrenzen hierboven blijven gelden.
