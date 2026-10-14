'use strict';
// Épisode 1 · Le dernier sifflet : tous les textes et dialogues.
// Format des scripts : voir l'en-tête de src/dialog.js.
(function () {
  const G = window.G;
  const T = (G.T1 = {});

  // ================================================================ OUVERTURE
  T.intro = [
    'On était huit, cet été-là. Je le sais parce que M\'man comptait les bols tous les soirs, à voix basse, comme on compte ses enfants sur un quai de gare.',
    'Huit. Elle disait : tant qu\'on est là, tous les huit, il peut rien nous arriver.',
    'Elle se trompait, bien sûr. Mais pas sur tout.',
  ];

  // ================================================================ PROLOGUE : LA MAISON (août)
  T.pIda = [
    ['ida', 'Te voilà. Tiens, les gamelles. Trois.'],
    ['ida', 'Celle avec le nœud rouge, c\'est pour ton père. Y a le dernier bout de lard dedans, alors tu la donnes à personne d\'autre.'],
    { c: [
      { t: '« Et moi, j\'ai droit au lard quand ? »', then: [['ida', 'Le jour où tu passeras dix heures debout devant la grande scie. Pas avant.'], ['ida', '… L\'an prochain, peut-être. Ton père parle de te faire entrer.']] },
      { t: '« Je cours, ils seront contents. »', then: [['ida', 'Tu cours pas. Si tu renverses, ils mangent rien jusqu\'à ce soir.']] },
    ] },
    ['ida', 'Et passe par la passerelle, pas par le gué. Je veux pas te récupérer trempé comme un chat.'],
    { set: { gotPails: true } },
  ];
  T.pHattie = [
    ['hattie', 'Dis à ton père que le temps tourne. Les geais crient depuis ce matin.'],
    ['henry', 'Il fait grand beau, Granny.'],
    ['hattie', 'Les geais savent des choses que le ciel sait pas encore.'],
  ];
  T.pRuth = [
    ['ruth', 'Miss Adair m\'a prêté un livre. Il s\'appelle « Les Quatre Filles du docteur March ».'],
    ['henry', 'Quatre filles ? Et pas un seul garçon ?'],
    ['ruth', 'Il y a un voisin. Laurie. Il est riche et il s\'ennuie.'],
    ['ruth', '… J\'aimerais bien m\'ennuyer, moi, une fois.'],
  ];
  T.pPearl = [
    ['pearl', 'Henry ! Tu vas à l\'usine ?'],
    ['henry', 'Je porte les gamelles.'],
    ['pearl', 'Quand le sifflet de midi il siffle, je compte. Hier je suis arrivée jusqu\'à onze !'],
    { c: [
      { t: '« Onze ? C\'est déjà beaucoup. »', then: [['pearl', 'Aujourd\'hui je vais jusqu\'à vingt.']] },
      { t: '« Et après onze, il y a quoi ? »', then: [['pearl', '… Douze ?'], ['henry', 'Bravo.'], { mood: { pearl: 0.2 } }] },
    ] },
  ];
  T.pNeedPails = [['ida', 'Henry ! Les gamelles ! Tu crois qu\'ils vont manger avec les dents du peigne ?']];

  // ================================================================ PROLOGUE : LE CAMP
  T.pNora = [
    ['nora', 'Bonjour, Henry. Dis à ta mère que j\'ai toujours son plat à tarte. Je le rends dimanche, promis.'],
    ['henry', 'Bonjour, Mrs. Napier.'],
    ['nora', 'Et si tu vois mon Jimmy, dis-lui qu\'il rentre. Il court partout comme un poulet sans tête.'],
  ];
  T.pKid = [
    ['kid', 'Henry ! Je te fais la course jusqu\'à la passerelle !'],
    ['henry', 'J\'ai les gamelles, Jimmy.'],
    ['kid', 'T\'as peur de perdre, oui !'],
  ];
  T.pPruitt = [
    ['pruitt', 'Henry Caudill. Ton père a réglé l\'ardoise de juillet ?'],
    ['henry', 'Je sais pas, Mr. Pruitt.'],
    ['pruitt', 'Dis-lui de passer. Rien de grave. Les comptes, c\'est les comptes.'],
  ];
  T.pOtis = [
    ['otis', 'Henry ! Demain, à la pêche ? Mon père dit que les achigans remontent au trou de la Barbue.'],
    { c: [
      { t: '« Demain, sans faute. »', set: { otisPromise: true }, then: [['otis', 'Je prends les vers. Toi, tu prends ta canne et ta chance.']] },
      { t: '« Si M\'man me laisse. »', then: [['otis', 'Elle te laissera. Ta mère m\'aime bien.'], ['henry', 'Ma mère aime tout le monde.'], ['otis', 'Non. Pas tout le monde.']] },
    ] },
  ];

  // ================================================================ PROLOGUE : LA SCIERIE
  T.pMillArrive = [
    'Midi. Le sifflet. Comme tous les jours depuis que je suis né.',
  ];
  T.pPapa = (hasPail) => hasPail ? [
    ['kenneth', 'T\'as pas couru, j\'espère.'],
    ['henry', 'Non, Pap\'.'],
    ['kenneth', 'Menteur. T\'es rouge comme une pomme.'],
    ['kenneth', 'Assieds-toi deux minutes. Regarde la grande scie. L\'an prochain, c\'est toi qui la nourris.'],
    { c: [
      { t: '« J\'ai hâte. »', mood: { kenneth: 0.2 }, then: [['kenneth', 'Faut pas avoir hâte. Faut avoir des bras.']] },
      { t: '« Ruth dit que je devrais rester à l\'école. »', then: [['kenneth', 'Ruth lit trop de livres.'], ['kenneth', '… Elle a peut-être raison. Mais l\'école, ça paie pas le loyer.']] },
    ] },
  ] : [
    ['kenneth', 'Et ma gamelle ?'],
    ['henry', 'Elle est tombée dans le ruisseau, Pap\'. Celle avec le nœud rouge.'],
    ['kenneth', '…'],
    ['kenneth', 'Bah. Les truites mangeront du lard, pour une fois. Elles l\'ont pas volé.'],
    { mood: { kenneth: -0.1 } },
  ];
  T.pClay = (hasPail) => [
    ...(hasPail ? [['clay', 'Merci, gamin.']] : [['clay', 'Ma gamelle ? Dans le ruisseau ? Bravo. Je mangerai de la sciure.']]),
    ['clay', 'Garvey est monté chez le patron ce matin. Il est redescendu avec une tête d\'enterrement.'],
    ['clay', 'Ils ont fermé la scierie de Quicksand le mois dernier. Celle de Jackson avant. Je te parie qu\'on est les suivants.'],
    { c: [
      { t: '« Papa dit que la Hollis fermera jamais. »', then: [['clay', 'Papa dit aussi que les Démocrates vont tout arranger. Papa dit beaucoup de choses.']] },
      { t: '« Qu\'est-ce qu\'on ferait, si ça fermait ? »', then: [['clay', 'Moi ? La mine. Ou Detroit. N\'importe où où on paie en dollars.']] },
    ] },
  ];
  T.pWes = (hasPail) => [
    ...(hasPail ? [['wes', 'Ah ! Le facteur. Qu\'est-ce que M\'man nous a mis ? Du pain de maïs. Quelle surprise.']] : [['wes', 'Pas de gamelle ? Bah. J\'avais pas faim. … Si, j\'avais faim.']]),
    ['wes', 'Ce soir, je te montre le nouveau morceau. « Shady Grove ». J\'ai trouvé comment on fait le passage du milieu.'],
    ['henry', 'Tu me l\'as déjà joué cent fois.'],
    ['wes', 'Pas comme ça. Ce soir, tu vas pleurer.'],
  ];
  T.pWorker = [
    ['worker', 'Le petit Caudill ! T\'as pas une quatrième gamelle, des fois ?'],
    ['worker', 'Je rigole. Va, va.'],
  ];
  T.pAnnounce = [
    ['garvey', 'Messieurs. Messieurs, s\'il vous plaît. La compagnie m\'a demandé de vous lire ceci.'],
    ['garvey', '« En raison de la situation économique, la Hollis Lumber and Stave Company cesse toute activité à Hollis à compter de ce jour. »'],
    ['garvey', '« Les salaires de la semaine seront versés samedi. Les logements de la compagnie restent occupés aux conditions habituelles, jusqu\'à nouvel ordre. »'],
    'Personne ne bougea. On entendait la rivière.',
    ['worker', 'Aux conditions habituelles. Ça veut dire qu\'on paie le loyer avec quoi ?'],
    ['garvey', 'Je suis désolé, les gars. J\'y suis pour rien. Moi aussi, je pars.'],
    ['garvey', 'Vingt-deux ans que je tire ce sifflet. Je vais le tirer une dernière fois. Si ça vous dérange pas.'],
  ];
  T.pWhistleThoughts = [
    'Il a tiré la chaîne. Longtemps.',
    'Les hommes se sont levés, un par un. Papa a enlevé son chapeau.',
  ];
  T.pAfterWhistle = [
    { c: [
      { t: 'Prendre la main de Papa', mood: { kenneth: 0.3, henry: 0.1 }, then: ['Sa main était chaude et pleine de sciure. Il l\'a serrée, une fois.'] },
      { t: 'Regarder Clay', then: ['Clay regardait la cheminée, les mâchoires serrées. Il avait déjà décidé quelque chose.'] },
      { t: 'Ne rien faire', silent: true, then: ['Je n\'ai rien fait. Je crois que personne ne savait quoi faire.'] },
    ], timer: 7, prompt: 'Le sifflet hurle au-dessus de la vallée.' },
    'Quelque part au camp, Pearl devait compter. Elle a dû arriver bien plus loin que vingt.',
  ];
  T.pPapaPail = (hasPail) => hasPail ? [
    ['kenneth', 'Tiens.'],
    'Il me rendit sa gamelle. Il n\'y avait pas touché.',
    ['kenneth', 'Ramène ça à ta mère. Elle en aura besoin.'],
  ] : [
    ['kenneth', 'Rentre, Henry. Dis à ta mère que… dis-lui qu\'on arrive.'],
  ];
  T.pAfterMill = [
    'Le lendemain, ils ont mis une chaîne sur la grille. Papa est allé la regarder tous les matins pendant une semaine, à l\'heure du sifflet.',
    'Les économies ont tenu jusqu\'en septembre. La dernière paie, jusqu\'au début d\'octobre.',
    'Puis M\'man a arrêté de compter les bols à voix haute.',
  ];

  // ================================================================ JOUR 1 : LE MATIN
  T.d1Wake = [
    'Six heures. L\'heure du sifflet.',
    'Rien. Le silence. Même les chiens attendaient.',
  ];
  T.d1Papa = [
    ['henry', 'Pap\' ?'],
    ['kenneth', '… Vingt ans que je me lève à cette heure-là. Le corps, il sait pas que c\'est fini.'],
    { c: [
      { t: '« Tu vas chercher du travail aujourd\'hui ? »', then: [['kenneth', 'À Hazard, avec Clay. Y a une scierie qui embauche, paraît-il. Paraît-il.']] },
      { t: '« Reviens te coucher, Pap\'. »', then: [['kenneth', 'Un homme qui se recouche, il se relève plus.']] },
      { t: 'Rester à côté de lui sans rien dire', silent: true, mood: { kenneth: 0.3 }, set: { stoodWithPapa: true }, then: ['On est restés là, tous les deux, à regarder la cheminée froide de l\'usine. Au bout d\'un moment, il a posé sa main sur mon épaule.'] },
    ] },
  ];
  T.d1Ida = [
    ['ida', 'T\'es levé. Bien. Écoute-moi.'],
    ['ida', 'Le loyer, c\'est samedi. Huit dollars. M. Farris, l\'agent de la compagnie, passe faire sa tournée.'],
    ['ida', 'On a quarante cents. Pas un de plus.'],
    'Elle me mit les pièces dans la main et referma mes doigts dessus, comme si elles allaient s\'envoler.',
    ['ida', 'Tu vas au magasin. De la farine de maïs, du lard. Des haricots, si ça suffit.'],
    ['ida', 'Et pas de crédit, Henry. L\'ardoise est déjà à dix-sept dollars.'],
    { c: [
      { t: '« Et le loyer, on le paie comment ? »', then: [['ida', 'On trouvera. Ton père cherche, les garçons cherchent. Et toi, tu ramènes ce que tu peux.'], ['ida', 'Sans voler et sans mentir.']] },
      { t: '« Et l\'école ? »', then: [['ida', 'Cette semaine, l\'école, c\'est pour Ruth. Toi, on a besoin de toi.'], ['ida', '… Je suis désolée, mon grand.']] },
    ] },
    { set: { gotErrand: true } },
  ];
  T.d1IdaAgain = [['ida', 'Le magasin, Henry. Farine de maïs, lard, haricots si ça suffit. Pas de crédit.']];
  T.d1Hattie = [
    ['hattie', 'Viens là, toi.'],
    'Elle me prit le menton et me tourna la tête vers la fenêtre, comme pour vérifier que j\'étais encore bon.',
    ['hattie', 'Demain, je t\'emmène au sang. Le ginseng, mon garçon. Là-haut, sous les hêtres.'],
    ['hattie', 'Trois belles racines, ça fait la moitié d\'un loyer. Ton grand-père m\'y emmenait. À ton âge, il le reconnaissait à vingt pas.'],
    { c: [
      { t: '« Et toi, tu le reconnais encore ? »', then: [['hattie', 'J\'ai les yeux d\'une vieille et les genoux d\'une morte. Mais le sang, je le sentirais dans le noir.']] },
      { t: '« Pourquoi on y est pas allés avant ? »', then: [['hattie', 'Parce que ton père avait sa paie, et sa fierté. Il lui reste la fierté.']] },
    ] },
  ];
  T.d1Ruth = [
    ['ruth', 'Henry, tu savais que le Kentucky a cent vingt comtés ? Miss Adair dit que c\'est presque un record.'],
    ['henry', 'Et ça sert à quoi ?'],
    ['ruth', 'À rien. C\'est pour ça que c\'est bien.'],
    ['ruth', '… Tu crois que je vais devoir arrêter l\'école, moi aussi ?'],
    { c: [
      { t: '« Non. Toi, tu continues. »', set: { promiseRuth: true }, mood: { ruth: 0.4 }, then: [['ruth', 'Tu promets ?'], ['henry', 'Je promets.'], 'Je ne savais pas du tout comment j\'allais tenir cette promesse.'] },
      { t: '« J\'en sais rien, Ruth. »', mood: { ruth: -0.2 }, then: [['ruth', 'D\'accord.'], 'Elle replongea dans son livre. Elle ne lisait plus.'] },
    ] },
  ];
  T.d1Pearl = [
    ['pearl', 'Henry. Le sifflet, il est cassé ?'],
    ['henry', '… Oui. Il est cassé.'],
    ['pearl', 'On peut le réparer ?'],
    { c: [
      { t: '« Peut-être. Un jour. »', then: [['pearl', 'Alors je garde mes chiffres pour ce jour-là.']] },
      { t: '« Non. »', mood: { pearl: -0.2 }, then: [['pearl', 'Oh.']] },
      { t: 'Faire le sifflet avec ta bouche', mood: { pearl: 0.6, all: 0.08 }, set: { whistledForPearl: true }, then: ['Je mis mes mains en cornet et je fis « Houuuuuuu ». Pearl éclata de rire. Elle compta jusqu\'à neuf. De la cuisine, j\'entendis M\'man rire aussi, une seconde.'] },
    ] },
  ];
  T.d1Clay = [
    ['clay', 'Je descends à Hazard avec Pap\'. Et s\'il y a rien, je vais voir à la n° 4.'],
    ['henry', 'La n° 4 est en grève.'],
    ['clay', 'Justement. Y a de la place.'],
    'Il serra ses lacets si fort qu\'un des deux cassa.',
  ];
  T.d1Wes = [
    ['wes', 'Il me reste trois cordes. Une corde, c\'est quinze cents. Quinze cents, c\'est trois livres de farine.'],
    ['wes', 'Alors je jouerai sur trois cordes.'],
    { c: [
      { t: '« Ça s\'entendra ? »', then: [['wes', 'Seulement si t\'écoutes.']] },
      { t: '« Vends-le, ton violon. »', mood: { wes: -0.3 }, then: [['wes', '…'], ['wes', 'Le jour où je vends ce violon, Henry, c\'est qu\'on aura vraiment plus rien.']] },
    ] },
  ];

  // ================================================================ JOUR 1 : LE MAGASIN
  T.d1StoreIntro = [
    ['nora', 'Juste un peu de farine, Mr. Pruitt. Abner touchera quelque chose à la fin du mois.'],
    ['pruitt', 'Votre ardoise est à vingt-six dollars, Mrs. Napier. Je peux pas. C\'est la compagnie qui décide, pas moi.'],
    ['nora', '… Je comprends.'],
    'Elle se retourna et me vit. Elle aurait préféré que je ne sois pas là.',
    ['nora', 'Bonjour, Henry.'],
    { c: [
      { t: 'Lui donner cinq de tes quarante cents', set: { helpedNapier: true }, log: 'helpedNapier', note: 'Mrs. Napier s\'en souviendra.', then: [['nora', 'Non, Henry. Non. Ta mère…'], ['henry', 'M\'man ferait pareil.'], ['nora', '… Dieu te garde, mon garçon.'], { do: () => { G.state.flags.cash = 35; } }] },
      { t: '« Bonjour, Mrs. Napier. »', then: [['nora', 'Salue ta mère.']] },
      { t: 'Baisser les yeux', silent: true, then: ['Je regardai mes chaussures. Elle passa à côté de moi sans bruit.'] },
    ] },
  ];
  T.d1StoreOutro = [
    ['pruitt', 'Dis à ta mère que M. Farris passe samedi pour les loyers. Et…'],
    'Il baissa la voix, comme si les boîtes de conserve pouvaient l\'entendre.',
    ['pruitt', 'On dit que la compagnie voudrait vendre le camp à la Black Mountain. Les maisons avec. Je dis ça, je dis rien.'],
    ['pruitt', 'Ah, et Thornbury, l\'acheteur de racines, passe jeudi. Si ta grand-mère a encore l\'œil, c\'est le moment.'],
  ];

  // ================================================================ JOUR 1 : LA PÊCHE
  T.d1FishIntro = () => [
    `L'après-midi, Otis m'attendait au trou de la Barbue${G.flag('otisPromise') ? ', comme promis' : ''}. Il avait des vers dans une boîte de tabac.`,
    ['otis', 'T\'es en retard. Les poissons ont faim, eux aussi.'],
  ];
  T.d1FishTalk = [
    [
      ['otis', 'Mon père dit que la n° 4 va embaucher des jaunes. Des briseurs de grève.'],
      { c: [
        { t: '« Mon frère Clay en parle. »', then: [['otis', '…'], ['otis', 'Si ton frère y va, mon père et lui, ils seront plus du même côté de la route.']] },
        { t: '« Ton père fait grève ? »', then: [['otis', 'Il dit qu\'un homme qui creuse le charbon d\'un autre pour un dollar, il creuse sa propre tombe.']] },
      ] },
    ],
    [
      ['otis', 'Tu te souviens quand on a sauté du pont du chemin de fer ?'],
      ['henry', 'Ta mère t\'a battu pendant une semaine.'],
      ['otis', 'Et la tienne t\'a pas battu du tout. Elle a pleuré. C\'était pire.'],
    ],
    [
      ['otis', 'Les gens du camp d\'en haut, ils aiment pas qu\'on pêche ensemble, toi et moi.'],
      { c: [
        { t: '« Ils ont faim comme vous. Ils ont pas le temps de penser à ça. »', then: [['otis', 'T\'as jamais vu quelqu\'un qui avait faim et le temps de détester, toi ?']] },
        { t: '« Ils ont qu\'à pêcher ailleurs. »', set: { otisFriend: true }, then: [['otis', 'T\'es têtu, Henry Caudill.'], ['otis', 'C\'est bien.']] },
      ] },
    ],
    [
      ['otis', 'Si on en prend assez, j\'en ramène pour ma petite sœur. Elle mange que du pain de maïs depuis septembre.'],
    ],
  ];
  T.d1FishEnd = (fishCount) => fishCount > 0 ? [
    'Le soleil était passé derrière la crête. Otis rangea sa ligne.',
    { c: [
      { t: 'Donner ton plus beau poisson à Otis', set: { gaveFishOtis: true }, log: 'gaveFishOtis', note: 'Otis s\'en souviendra.', then: [['otis', '…'], ['otis', 'Merci. Je te le rendrai, Henry. D\'une façon ou d\'une autre.']] },
      { t: 'Tout garder pour la famille', then: [['otis', 'C\'est normal. Huit bouches, c\'est huit bouches.'], 'Il le dit gentiment. C\'était pire.'] },
    ] },
  ] : [
    'Le soleil était passé derrière la crête. Rien. Pas une écaille.',
    ['otis', 'Prends ça.'],
    'Il me tendit un de ses poissons. Je voulus refuser. Il était déjà parti.',
    { set: { otisGaveFish: true } },
  ];

  // ================================================================ JOUR 1 : LA TABLE
  T.d1TableIntro = [
    ['ida', 'Asseyez-vous.'],
    ['clay', 'Hazard, rien. Trois cents hommes devant la grille pour dix places.'],
    ['kenneth', 'Clay. Pas à table.'],
  ];
  T.d1TableAfter = (short) => [
    ...(short ? [
      'Papa remplit les bols. Arrivé au sien, il n\'y versa qu\'une demi-louche.',
      ['ruth', 'T\'en as presque pas, Pap\'.'],
      ['kenneth', 'J\'ai pas travaillé aujourd\'hui. Un homme qui travaille pas a pas besoin de manger comme un homme qui travaille.'],
      'Personne ne répondit. Clay reposa sa cuillère.',
    ] : [
      'Papa remplit les bols, chacun le sien, et le sien en dernier. Pour une fois, il y en eut pour tout le monde.',
    ]),
    { c: [
      { t: 'Donner la moitié de ton bol à Pearl', set: { gaveToPearl: true }, mood: { pearl: 0.2, ida: 0.1 }, do: () => G.T1.hooks.transfer('henry', 'pearl', 1) },
      { t: 'Donner la moitié de ton bol à Papa', if: () => short, mood: { kenneth: 0.2 }, do: () => G.T1.hooks.transfer('henry', 'kenneth', 1), then: [['kenneth', 'Henry…'], ['henry', 'Moi non plus, j\'ai pas travaillé.'], 'Il me regarda longtemps. Puis il mangea.'] },
      { t: 'Manger', silent: true },
    ] },
    ...(short ? [{ c: [
      { t: 'Regarder le bol de M\'man', set: { sawIdaBowl: true }, then: ['Le bol de M\'man était propre. Pas une trace de cuillère. Elle souriait à Pearl.'] },
      { t: 'Regarder par la fenêtre', silent: true },
    ], prompt: 'Pendant qu\'ils mangent…' }] : []),
    ['clay', 'La Black Mountain embauche. Un dollar cinquante la journée, payé comptant.'],
    ['kenneth', 'Elle embauche parce que les hommes de la n° 4 sont en grève. Tu prendras pas le pain d\'un homme qui se bat pour le sien.'],
    ['clay', 'Et ce pain-là, Pap\', il est où ? Dans le bol de Pearl ?'],
    { c: [
      { t: 'Soutenir Clay : « Il a raison, Pap\'. »', set: { sidedClay: true }, mood: { clay: 0.4, kenneth: -0.4 }, log: 'sidedClay', then: [['kenneth', '…'], 'Papa se leva et sortit sur le perron. La porte ne claqua pas. C\'était pire.'] },
      { t: 'Soutenir Papa : « On fait pas ça aux Hairston. »', set: { sidedPapa: true }, mood: { kenneth: 0.3, clay: -0.4 }, log: 'sidedPapa', then: [['clay', 'Les Hairston. Les Hairston mangent, eux ?'], ['clay', '… Laisse tomber.']] },
      { t: 'Se taire', silent: true, set: { silentTable: true }, log: 'silentTable', then: ['Je regardai mon bol. Le silence dura jusqu\'à ce que Pearl renverse son lait.'] },
    ], timer: 9, prompt: 'Ils te regardent tous les deux.' },
  ];

  // ================================================================ VEILLÉES
  T.v1 = {
    ida: (s) => G.flag('sawIdaBowl') ? [
      ['henry', 'M\'man, t\'as mangé ?'],
      ['ida', 'J\'ai goûté en cuisinant. Va te coucher.'],
      ['henry', 'Je t\'ai regardée. T\'as rien goûté du tout.'],
      ['ida', '…'],
      ['ida', 'Les petits d\'abord, Henry. Ça a toujours été comme ça. Chez ma mère, chez sa mère.'],
      { c: [
        { t: '« Demain, tu mangeras. Je m\'en occupe. »', set: { confrontedIda: true }, mood: { ida: 0.4 }, then: [['ida', 'Tu t\'en occupes. Écoutez-le.'], 'Elle rit doucement, puis elle me serra si fort que j\'en eus mal aux côtes.'] },
        { t: '« Si tu tombes malade, qui s\'occupera des petits ? »', set: { confrontedIda: true }, mood: { ida: 0.2 }, then: [['ida', '… T\'es plus malin que ton père, toi.'], ['ida', 'D\'accord. Demain, je mange.']] },
      ] },
    ] : [
      ['henry', 'Ça va, M\'man ?'],
      ['ida', 'Ça va. Ça va toujours, Henry. C\'est comme ça qu\'on tient.'],
      ['ida', 'Quand j\'avais ton âge, on a eu un hiver où on mangeait des glands. Des glands ! Bouillis trois fois.'],
      ['ida', 'Ça a un goût de rien et de colle. Mais on était tous là au printemps.'],
      { mood: { ida: 0.2 } },
    ],
    kenneth: (s) => [
      'Papa était sur le perron, dans le noir. Il ne fumait pas : il n\'avait plus de tabac depuis une semaine.',
      ['kenneth', 'Ton grand-père a travaillé à la mine de Jenkins, avant la scierie. Il disait qu\'un homme, c\'est ce qu\'il rapporte à la maison.'],
      ['kenneth', 'Ça fait deux mois que je rapporte rien, Henry.'],
      { c: [
        { t: '« T\'es pas ce que tu rapportes, Pap\'. »', mood: { kenneth: 0.4 }, set: { comfortedPapa: true }, then: [['kenneth', '…'], ['kenneth', 'Ta mère t\'a appris à parler, toi.'], 'Il ne dit rien d\'autre. Mais il resta sur le perron moins longtemps que les autres soirs.'] },
        { t: '« Alors je rapporterai pour deux. »', mood: { kenneth: -0.1, henry: 0.1 }, then: [['kenneth', 'C\'est pas ton travail.'], ['henry', 'Ça l\'est maintenant.'], 'Il ne répondit pas. J\'avais gagné, et ça ne faisait aucun plaisir.'] },
      ] },
    ],
    wes: (s) => [
      ['wes', 'Henry. Assieds-toi. J\'ai dit que tu pleurerais.'],
      'Il joua « Shady Grove » sur trois cordes. Il manquait des notes, alors il les chantait.',
      'Dans la chambre d\'à côté, Pearl s\'endormit. Granny tapait du pied. Même Papa, sur le perron, arrêta de bouger.',
      { mood: { all: 0.2, wes: 0.3 }, set: { wesPlayed: true }, note: 'Toute la maison a écouté.' },
      ['wes', 'Alors ?'],
      { c: [
        { t: '« J\'ai pas pleuré. »', then: [['wes', 'T\'as les yeux qui brillent.'], ['henry', 'C\'est la fumée du poêle.']] },
        { t: '« Joue-la encore. »', mood: { wes: 0.2 }, then: [['wes', 'Demain. Faut garder les cordes.']] },
      ] },
    ],
    ruth: (s) => [
      ['ruth', 'Tu m\'interroges ? Sur les capitales ?'],
      ['henry', 'La capitale du Kentucky.'],
      ['ruth', 'Frankfort. Trop facile. Une vraie !'],
      ['henry', 'La capitale de… de Detroit.'],
      ['ruth', 'Detroit, c\'est une ville, Henry. Pas un pays.'],
      ['ruth', '… Clay veut aller à Detroit. Je l\'ai entendu le dire à Wes.'],
      { c: [
        { t: '« Il dit ça pour faire peur à Papa. »', then: [['ruth', 'Ça marche.']] },
        { t: '« Peut-être qu\'on ira tous. »', then: [['ruth', 'Granny ira jamais. Elle dit qu\'elle mourra ici, et que ses os iront pas plus loin que le cimetière.'], ['ruth', 'Moi j\'irais. Ils ont des bibliothèques, à Detroit.']] },
      ] },
      { mood: { ruth: 0.2 } },
    ],
    pearl: (s) => [
      ['pearl', 'Henry. Raconte une histoire.'],
      { c: [
        { t: '« Il était une fois un renard… »', set: { storyHero: 'un renard' } },
        { t: '« Il était une fois une ourse… »', set: { storyHero: 'une ourse' } },
        { t: '« Il était une fois une petite fille qui s\'appelait Pearl… »', set: { storyHero: 'Pearl' } },
      ], prompt: 'Le héros de l\'histoire' },
      { c: [
        { t: '« … qui voulait monter sur la lune. »', set: { storyPlace: 'la lune' } },
        { t: '« … qui avait perdu le sifflet de l\'usine. »', set: { storyPlace: 'le sifflet' } },
        { t: '« … qui avait trouvé un champ entier de pain de maïs. »', set: { storyPlace: 'le pain' } },
      ], prompt: 'Et ensuite ?' },
      { if: () => G.state.flags.storyPlace === 'le pain', then: [['pearl', 'Avec du beurre ?'], ['henry', 'Avec du beurre, de la mélasse et du lard dessus.'], ['pearl', 'Oh.'], 'Elle s\'endormit avant la fin. Elle souriait.'],
        else: [['pearl', 'Et après ?'], ['henry', 'Après, elle est rentrée à la maison. Et tout le monde était là.'], ['pearl', 'Tous les huit ?'], ['henry', 'Tous les huit.'], 'Elle s\'endormit avant que j\'aie fini.'] },
      { mood: { pearl: 0.5, henry: 0.2 } },
    ],
    hattie: (s) => [
      ['hattie', 'Va dormir. Demain, on monte.'],
      ['hattie', 'Et prends tes vieilles chaussures. Le sang, ça se mérite.'],
    ],
    clay: (s) => [
      'Clay était déjà couché, tourné vers le mur.',
      ['henry', 'Clay ?'],
      ['clay', 'Dors.'],
    ],
  };
  T.v1Prompt = 'La maison se prépare pour la nuit. Avec qui veux-tu parler ?';
  T.v1Sleep = ['Je m\'endormis tout habillé. Dans la chambre, Clay ne dormait pas : je l\'entendais respirer comme quelqu\'un qui fait des comptes.'];

  // ================================================================ JOUR 2 : LA MONTAGNE
  T.d2Start = [
    'Granny m\'attendait sur le perron avant le jour, sa canne dans une main, un sac de farine vide dans l\'autre.',
    ['hattie', 'Ton père et Clay sont repartis à Hazard. Ils dormiront chez le cousin Ellis. Allez, en route.'],
  ];
  T.d2Walk = [
    [
      ['hattie', 'Ton grand-père et moi, on avait une ferme là-haut. Au bout du vallon. Quarante arpents de pente et une source qui gelait jamais.'],
      ['henry', 'Pourquoi vous êtes descendus ?'],
      ['hattie', 'La compagnie payait en dollars. La terre payait en patience. On a choisi les dollars.'],
      ['hattie', 'Regarde où ça nous a menés.'],
    ],
    [
      ['hattie', 'Écoute bien, maintenant. Le sang, ça se respecte.'],
      ['hattie', 'Trois ou quatre branches. Cinq feuilles par branche. Et les baies rouges au milieu, en bouquet.'],
      ['hattie', 'Tu prends la racine, tu laisses les baies. Tu les remets dans la terre, là où t\'as creusé. Sinon, dans dix ans, y en a plus pour personne.'],
    ],
    [
      ['hattie', 'Tu sens ? Le maïs qui fermente. Y a un alambic pas loin.'],
      ['henry', 'Dow Slone ?'],
      ['hattie', 'Qui d\'autre. Fais comme si t\'avais rien senti.'],
    ],
  ];
  T.d2Mistake = {
    creeper: [['hattie', 'C\'est de la vigne vierge, Henry. Elle grimpe aux arbres. Le sang, il grimpe à rien du tout : il attend.']],
    sarsaparilla: [['hattie', 'De la salsepareille. Ça ressemble, de loin, comme Clay ressemble à ton père. Mais y a pas de baies rouges au milieu.']],
    ivy: [['hattie', 'De l\'herbe à puce. T\'en as sur les mains, maintenant. Ça va te gratter jusqu\'à dimanche.'], { set: { itchy: true } }],
    jack: [['hattie', 'L\'arisème. Baies rouges, oui. Mais regarde les feuilles : trois par trois. Le diable aussi met du rouge pour qu\'on le choisisse.']],
  };
  T.d2Root = [
    [
      ['hattie', 'Elle a des jambes, des bras… Les Chinois disent que ça ressemble à un homme. C\'est pour ça qu\'ils la paient si cher.'],
      ['hattie', 'Et maintenant, les baies.'],
      { c: [
        { t: 'Replanter les baies là où tu as creusé', set: { plantedBerries: true }, log: 'plantedBerries', mood: { hattie: 0.4 }, then: ['J\'enfonçai les baies une à une avec le pouce, comme elle m\'avait montré. Granny hocha la tête.', ['hattie', 'Dans dix ans, tu reviendras ici. Avec tes enfants, peut-être.']] },
        { t: 'Les laisser tomber pour aller plus vite', mood: { hattie: -0.3 }, then: [['hattie', '…'], ['hattie', 'Ton grand-père aurait pas fait ça. Mais ton grand-père avait pas faim comme toi.']] },
      ] },
    ],
    [['hattie', 'Celle-là, elle a vu passer la guerre de Sécession. Respecte ses cheveux blancs.']],
    [['hattie', 'Trois. On rentre avant que mes genoux décident pour moi.']],
  ];
  T.d2RootQuality = (q) => q >= 0.86
    ? [['hattie', 'Ça, c\'est du beau sang. Entière, de la tête aux pieds.']]
    : q >= 0.45 ? [['hattie', 'Un peu abîmée. Thornbury fera la grimace, mais il la prendra.']]
      : [['hattie', 'Cassée. Il en donnera moitié. Doucement, la prochaine : c\'est une racine, pas une souche.']];
  T.d2Dusk = [['hattie', 'Le jour tombe. On rentre.']];

  T.d2Dow = [
    ['dow', 'Tiens donc. La veuve Caudill et le petit dernier des garçons.'],
    ['hattie', 'Dow Slone. Ta mère serait pas fière de toi.'],
    ['dow', 'Ma mère est morte dans un lit en plume, Hattie. Grâce à moi.'],
    ['dow', 'Et toi, petit. T\'as des bonnes jambes ?'],
    ['dow', 'J\'ai une livraison vendredi soir. Six bocaux, du vallon jusqu\'au vieux hangar de la n° 4. Deux dollars.'],
    ['hattie', 'Il a quatorze ans, Dow.'],
    ['dow', 'Moi, j\'en avais douze.'],
    { c: [
      { t: '« Deux dollars ? Comptant ? »', then: [['dow', 'Comptant. Pas en bons de la compagnie. De l\'argent qui fait du bruit.'], ['dow', 'Vendredi, à la nuit tombée, au gros sycomore. Si t\'y es, t\'y es. Si t\'y es pas, t\'y es pas.']] },
      { t: '« Non. »', set: { refusedDowEarly: true }, then: [['dow', 'Comme tu veux.'], ['dow', 'Ton frère Clay dira peut-être oui, lui. Il a l\'air d\'avoir soif d\'argent, ce garçon.']] },
      { t: 'Regarder Granny', silent: true, then: ['Granny tira sur sa pipe. Elle ne dit ni oui ni non.', ['dow', 'Vendredi. Au gros sycomore. Réfléchis.']] },
    ] },
    'Sur le chemin du retour, Granny resta longtemps sans parler. Puis :',
    ['hattie', 'Ton grand-père a fait pire, pour nous nourrir. Mais il s\'est jamais fait prendre.'],
  ];

  // ================================================================ JOUR 2 : LE SOIR
  T.d2NoraKnock = [
    { sfx: 'knock' },
    'On frappa. C\'était Mrs. Napier, un bol couvert d\'un torchon dans les mains.',
    ['nora', 'Des haricots. On a eu un sac de la Croix-Rouge. C\'est pour hier matin, au magasin.'],
    ['nora', 'On oublie pas, chez les Napier.'],
  ];
  T.d2TableIntro = [
    'Papa et Clay n\'étaient pas rentrés. Leurs places restaient vides, avec les bols retournés.',
    ['ida', 'Sers, toi, Henry. Moi, j\'ai plus le cœur à compter.'],
  ];
  T.d2HattieRefuse = [
    ['hattie', 'Pas pour moi. Garde mon bol pour la petite.'],
    ['hattie', 'À mon âge, on a plus besoin de grand-chose. Le Seigneur me nourrit de souvenirs.'],
  ];
  T.d2HattieChoice = [
    { t: 'Insister : « Mange, Granny. Demain on vend tes racines. »', mood: { hattie: 0.2 } },
    { t: 'Laisser faire', silent: true },
  ];
  T.d2TableAfter = (o) => [
    ...(o.idaPoured && !G.flag('confrontedIda') ? ['Quand tout le monde eut le nez dans son bol, M\'man versa le sien dans celui de Pearl, sans un bruit. Elle croyait que personne ne la voyait.'] : []),
    ...(o.idaAte ? ['M\'man mangea. Lentement, en me regardant de temps en temps, comme pour me dire : tu vois, je tiens parole.'] : []),
    ...(o.grainOnly ? [['hattie', 'Que du maïs, encore. Ça finit par vous ronger la peau, le maïs tout seul. On appelle ça la pellagre, à l\'hôpital de Hazard.']] : []),
  ];
  T.v2 = {
    hattie: () => [
      ['hattie', 'Approche. Tu veux savoir pour la ferme ?'],
      ['hattie', 'Elle est toujours là-haut, tu sais. Le toit est crevé et les ronces sont entrées dans la cuisine. Mais la source coule.'],
      ['hattie', 'Une source, Henry, c\'est la seule chose au monde qui te demande jamais de loyer.'],
      { c: [
        { t: '« On pourrait y retourner ? »', set: { askedFarm: true }, mood: { hattie: 0.5 }, then: [['hattie', 'Ton père dira non. Ta mère dira peut-être. Et moi je dis : quand vous voudrez.'], ['hattie', 'J\'ai encore la clé. Elle ferme plus rien, mais je l\'ai.']] },
        { t: '« Là-haut, y a rien à manger. »', then: [['hattie', 'Y a pas grand-chose ici non plus. Mais ici, faut payer pour avoir rien.']] },
      ] },
    ],
    ida: () => G.flag('confrontedIda') ? [
      ['ida', 'T\'as vu ? J\'ai mangé.'],
      ['henry', 'J\'ai vu.'],
      ['ida', 'T\'es pire qu\'un contremaître.'],
      { mood: { ida: 0.2 } },
    ] : [
      ['ida', 'Henry, t\'as rangé les racines de Granny dans la boîte en fer ? Les souris les mangeraient.'],
      ['henry', 'Oui, M\'man.'],
      ['ida', 'Jeudi, on les vend. Samedi, on paie. Dimanche, on respire.'],
      ['ida', 'Un jour à la fois. C\'est comme ça qu\'on monte une montagne.'],
    ],
    ruth: () => [
      ['ruth', 'Miss Adair a dit que les élèves qui ont faim, on leur donne une soupe à midi. Les Quakers envoient les sacs.'],
      ['ruth', 'J\'en ai mangé la moitié. L\'autre moitié, je l\'ai mise dans mon mouchoir pour Pearl.'],
      ['ruth', 'Elle était froide quand je suis rentrée. Pearl l\'a mangée quand même.'],
      { c: [
        { t: '« T\'es la meilleure d\'entre nous, Ruth. »', mood: { ruth: 0.4 } },
        { t: '« Mange ta soupe, la prochaine fois. Toute. »', then: [['ruth', 'Toi, tu donnes bien ton bol.'], ['henry', '…']] },
      ] },
    ],
    wes: () => [
      ['wes', 'Pruitt m\'a fait scier du bois toute la journée. Soixante cents. Je les garde pour samedi.'],
      ['wes', 'Il m\'a demandé si je vendrais pas mon violon. Il connaît un type à Hazard qui donne trois dollars.'],
      { c: [
        { t: '« Trois dollars, c\'est presque la moitié du loyer. »', mood: { wes: -0.3 }, set: { suggestedFiddle: true }, then: [['wes', 'Je sais compter, Henry.'], ['wes', '… Si samedi il manque de l\'argent, je le vends. Pas avant.']] },
        { t: '« Le garde pas pour lui, garde-le pour nous. »', mood: { wes: 0.3 }, then: [['wes', 'Pour nous ?'], ['henry', 'Qui joue, sinon, quand ça va mal ?'], ['wes', 'Personne. C\'est bien ce que je me disais.']] },
      ] },
    ],
    pearl: () => [
      ['pearl', 'Henry, j\'ai faim dans mes rêves aussi.'],
      ['henry', 'Qu\'est-ce que tu manges, dans tes rêves ?'],
      ['pearl', 'Une orange. Comme à Noël.'],
      'La compagnie donnait une orange à chaque enfant du camp, à Noël. Je me demandai qui allait les donner, cette année.',
      { mood: { pearl: 0.2 } },
    ],
  };
  T.v2Prompt = 'Papa et Clay ne sont pas rentrés. Avec qui veux-tu parler ?';
  T.v2Sleep = ['Cette nuit-là, j\'ai rêvé de racines qui marchaient toutes seules jusqu\'au magasin de Pruitt.'];

  // ================================================================ JOUR 3 : LE BOURG
  T.d3Intro = [
    'Le mercredi, il plut toute la journée. Papa rentra de Hazard le soir, à pied, trempé jusqu\'aux os. Clay n\'était pas avec lui.',
    'Il n\'a rien dit. On n\'a rien demandé.',
    'Le jeudi, le camion de Thornbury était devant le magasin.',
  ];
  T.d3Thornbury = [
    ['thornbury', 'Le petit-fils de Hattie Caudill ! Elle m\'a vendu ses premières racines quand j\'avais encore des cheveux.'],
    ['thornbury', 'Montre-moi ce que t\'as.'],
  ];
  T.d3Whitcomb = [
    ['whitcomb', 'Excuse-moi, jeune homme. Ellis Whitcomb. Je fais un reportage pour un journal de Chicago, sur les familles de la région.'],
    ['whitcomb', 'On m\'a dit que la scierie avait fermé en août. Comment vous vous en sortez, chez toi ?'],
    { c: [
      { t: '« On s\'en sort. »', set: { toldWhitcomb: 'pride' }, then: [['whitcomb', 'C\'est ce que tout le monde me répond. Exactement ces mots-là.']] },
      { t: '« On a faim, monsieur. »', set: { toldWhitcomb: 'truth' }, then: [['whitcomb', '…'], ['whitcomb', 'Merci de me le dire franchement. Peu de gens le font.'], 'Il écrivit quelque chose dans son carnet, longtemps.'] },
      { t: '« Ça vous regarde pas. »', set: { toldWhitcomb: 'no' }, then: [['whitcomb', 'Tu as raison. Excuse-moi.']] },
    ] },
    ['whitcomb', 'J\'aimerais photographier ta famille, samedi. Je vous donnerai un tirage, à vous. Et un dollar pour le dérangement.'],
    ['whitcomb', 'Tu veux bien demander à tes parents ?'],
    ['henry', 'Je demanderai.'],
    { set: { metWhitcomb: true } },
  ];
  T.d3Sold = (c, to) => to === 'pruitt' ? [
    'Pruitt me racheta les racines pour presque rien. Je savais que Thornbury les lui reprendrait le double, le lendemain.',
  ] : [`Thornbury compta ${G.U.money(c)} dans ma main, pièce par pièce. Je n'avais jamais tenu autant d'argent.`];

  // ================================================================ JOUR 3 : LE BEURRE DE POMMES
  T.d3AppleIntro = [
    'Le soir, chez les Napier, on faisait le beurre de pommes. Tout le camp d\'en bas était là, autour de la bassine de cuivre.',
    ['nora', 'Henry ! Viens prendre la palette. Abner a les bras en compote.'],
    ['abner', 'Quarante ans que je touille. Et c\'est la première fois qu\'on fait le beurre avec les pommes du voisin. Les nôtres, on les a mangées en août.'],
    ['wes', 'Henry, suis le violon. Si tu t\'arrêtes, ça attache.'],
  ];
  T.d3AppleInterlude = [
    [
      ['abner', 'Paraît que la compagnie vend le camp à la Black Mountain.'],
      ['ida', 'Qui dit ça ?'],
      ['abner', 'Pruitt. Et Pruitt sait tout, vu qu\'il tient l\'ardoise de tout le monde.'],
      ['hattie', 'Si on vend le camp, on remonte au vallon. J\'ai encore la clé.'],
      ['ida', 'Y a plus de toit sur cette maison, Hattie.'],
      ['hattie', 'Y avait pas de toit au paradis non plus.'],
    ],
    [
      ['nora', 'Wes Caudill, si tu joues comme ça à l\'église, le pasteur va se mettre à danser.'],
      ['wes', 'C\'est le plan, Mrs. Napier.'],
      ['wes', 'Henry ! Celle-là, elle va plus vite. Accroche-toi.'],
    ],
  ];
  T.d3AppleAfter = (jars) => [
    `À minuit, le beurre était prêt : épais, sombre, brillant comme du cuir neuf. Mrs. Napier remplit ${jars > 1 ? `${jars} pots` : 'un pot'} pour nous.`,
    ...(G.flag('helpedNapier') ? [['nora', 'Et un de plus. Pour les cinq cents de lundi.'], { set: { extraJar: true } }] : []),
    'Au bord de la lumière, contre la clôture, quelqu\'un regardait le feu. Otis. Les Hairston n\'étaient pas invités. Ils ne l\'étaient jamais.',
    { c: [
      { t: 'Lui porter une cuillère de beurre de pommes', set: { otisApple: true }, then: [['otis', '…'], ['otis', 'Ça sent comme chez ma grand-mère, en Alabama.'], ['otis', 'Rentre, Henry. Ils te regardent.'], ['henry', 'Qu\'ils regardent.']] },
      { t: 'Lui faire un signe de la main', then: ['Il me rendit mon signe et disparut dans le noir.'] },
    ] },
    'Sur le chemin du retour, je parlai du photographe à M\'man.',
    ['ida', 'Une photo ? De nous ?'],
    'Elle s\'arrêta au milieu du chemin.',
    ['ida', 'On en a jamais eu. Pas une seule. Même pas de mon mariage.'],
    ['kenneth', 'Pour montrer aux gens de Chicago comment vivent les pauvres du Kentucky ? Non.'],
    ['ida', 'Kenneth…'],
    ['kenneth', 'J\'ai dit non.'],
  ];

  // ================================================================ JOUR 4 : VENDREDI
  T.d4Count = (money) => [
    'Vendredi soir, M\'man vida la boîte à café sur la table et compta.',
    ...(G.flag('refusedDowEarly') ? ['J\'avais dit non à Dow Slone. Mais je n\'arrêtais pas de compter, moi aussi.'] : []),
    `${G.U.money(money)}. Il manquait ${G.U.money(Math.max(0, 800 - money))} pour le loyer.`,
    ['ida', 'Wes a ses soixante cents. Ruth a ses dix. Moi, la lessive du docteur : soixante-quinze. Et le dollar du photographe, s\'il revient.'],
    ['ida', 'On verra demain. Allez, au lit.'],
    'Par la fenêtre, je voyais la crête et le noir des bois. Quelque part là-dedans, il y avait un gros sycomore.',
  ];
  T.d4Choice = [
    { c: [
      { t: 'Attendre que tout le monde dorme, et aller au gros sycomore', set: { wentDow: true } },
      { t: 'Rester au lit', silent: true, set: { stayedHome: true } },
    ], prompt: 'Deux dollars. Comptant.' },
  ];
  T.d4Start = [
    'J\'attendis que Clay ronfle. Il était rentré tard, sans un mot, et s\'était couché tout habillé.',
    'Au gros sycomore, Dow m\'attendait avec une caisse de six bocaux, emballés dans de la paille.',
    ['dow', 'L\'agent de la Prohibition rôde sur la route de la n° 4. Il a une lanterne. Toi, t\'en as pas.'],
    ['dow', 'Reste dans les arbres, fais pas chanter les bocaux, et quand il lève sa lanterne, tu deviens une souche. Compris ?'],
  ];
  T.d4Arrive = [
    'Au vieux hangar du carreau, une ombre se détacha du mur.',
    ['dow', '…'],
    'Ce n\'était pas Dow. C\'était Lige, son cousin, un grand type maigre qui sentait le tabac à chiquer.',
  ];
  T.d4Lige = (jars, pay) => [
    `Il compta les bocaux. ${jars} sur 6.`,
    ...(jars < 6 ? ['Il ne dit rien pour les bocaux cassés. Il retira simplement des pièces de sa main avant de me la tendre.'] : []),
    `${G.U.money(pay)}. De l'argent qui faisait du bruit.`,
    'Il me dit de rentrer par la crique, pas par la route. Je rentrai par la crique.',
  ];
  T.d4Back = [
    'Quand je me glissai dans la maison, il y avait de la lumière dans la cuisine. Granny fumait, assise dans le noir.',
    ['hattie', 'T\'as l\'odeur du maïs fermenté, mon garçon.'],
    ['hattie', 'Lave-toi les mains avant que ta mère se lève. Et cache tes sous ailleurs que dans tes chaussettes : c\'est le premier endroit où les mères regardent.'],
  ];
  T.d4Stay = [
    'Je restai au lit. Je regardai le plafond jusqu\'à ce que mes yeux piquent.',
    'Vers minuit, j\'entendis Clay se lever. La porte. Ses pas sur le perron. Puis plus rien.',
    'Je savais où il allait. Je n\'ai rien dit.',
    { set: { clayDidRun: true } },
  ];

  // ================================================================ JOUR 5 : SAMEDI
  T.d5Pool = (o) => [
    'Samedi matin, toute la famille était autour de la table. Personne ne mangeait : il n\'y avait rien à manger avant le loyer.',
    ['ida', 'Bon. Chacun pose ce qu\'il a.'],
    ['wes', 'Soixante cents. Le bois de Pruitt.'],
    ['ruth', 'Dix cents. Miss Adair m\'a payée pour nettoyer le tableau noir.'],
    ['ida', 'Soixante-quinze. La lessive du docteur.'],
    'Granny sortit sa vieille boîte à tabac, l\'ouvrit, et fit glisser deux pièces sur la table.',
    ['hattie', 'Vingt-cinq. C\'était pour mon enterrement. Il attendra.'],
    ...(o.clayMoney ? (o.clayHurt ? [
      'Clay posa un dollar cinquante sur la table. Il avait la lèvre fendue et un œil qui commençait à virer au violet.',
      ['kenneth', 'D\'où ça sort ?'],
      ['clay', 'Te mêle pas d\'où ça sort.'],
      ['kenneth', 'Je me mêle de ce que je veux sous mon toit.'],
      ['clay', 'Ton toit ? C\'est le toit de la compagnie, Pap\'.'],
      'Personne ne parla pendant un long moment.',
    ] : [
      'Clay posa un dollar cinquante sur la table, sans regarder personne.',
      ['kenneth', 'La Black Mountain.'],
      ['clay', 'La Black Mountain. Un jour. Comme un jaune. Vas-y, dis-le.'],
      ['kenneth', '…'],
      'Papa ne le dit pas. Il regarda les pièces comme on regarde un chien qui a mordu quelqu\'un.',
    ]) : []),
    ['henry', `${G.U.money(o.henryMoney)}. ${o.dowMoney ? 'Le ginseng, et…' : 'Le ginseng de Granny.'}`],
    ...(o.dowMoney ? [
      ['kenneth', `C'est beaucoup, pour ${['zéro', 'une', 'deux', 'trois', 'quatre'][o.rootCount] || 'quelques'} racine${o.rootCount > 1 ? 's' : ''}.`],
      { c: [
        { t: 'Mentir : « Thornbury a payé plus que prévu. »', set: { liedToPapa: true }, log: 'liedToPapa', then: [['kenneth', 'Thornbury. Payer plus que prévu.'], 'Il me regarda. Puis il regarda Granny. Granny regardait ailleurs.', ['kenneth', '… Si tu le dis.']] },
        { t: 'Dire la vérité : « Deux dollars viennent de Dow Slone. »', set: { toldPapaTruth: true }, log: 'toldPapaTruth', mood: { kenneth: -0.3, ida: -0.2 }, then: [['ida', 'Henry !'], ['kenneth', 'Tu as porté le whisky de Dow Slone. À quatorze ans.'], ['henry', 'Le loyer, c\'est aujourd\'hui, Pap\'.'], 'Papa se leva. Je crus qu\'il allait me frapper. Il ne m\'avait jamais frappé.', ['kenneth', 'Ton grand-père aussi, il en a porté. Pendant la grève de dix-neuf cent onze.'], ['kenneth', 'Je te l\'interdis. Tu m\'entends ? Plus jamais.'], 'Mais il laissa l\'argent sur la table.'] },
      ], timer: 10, def: 0, prompt: 'Papa te regarde.' },
    ] : []),
  ];
  T.d5Farris = (o) => [
    { sfx: 'knock' },
    'Trois coups secs. M. Farris, l\'agent de la compagnie, avec son grand registre noir.',
    ['farris', 'Caudill. Loyer d\'octobre. Huit dollars.'],
    ...(o.paid ? [
      'M\'man compta les pièces dans sa main. Il les compta une deuxième fois.',
      ['farris', 'C\'est en ordre.'],
      ['farris', 'Profitez-en. D\'ici Noël, il se peut que ce soit plus la Hollis qui encaisse. Je dis ça…'],
      ['hattie', '… vous dites rien. On sait.'],
    ] : [
      ['ida', 'On a… on a ' + G.U.money(o.money) + ', monsieur Farris.'],
      ['farris', 'Il manque ' + G.U.money(800 - o.money) + '.'],
      { c: [
        { t: 'Mettre le reste sur l\'ardoise', if: () => G.state.ardoise + (800 - o.money) <= G.state.creditLimit, set: { rentOnCredit: true }, log: 'rentOnCredit', then: [['farris', 'Sur l\'ardoise. Bien.'], ['farris', 'Vous savez que la compagnie coupe le crédit à vingt-cinq dollars.'], ['ida', 'On sait.']] },
        { t: 'Demander un délai', set: { rentWarning: true }, log: 'rentWarning', then: [['farris', 'Un délai.'], 'Il écrivit dans son registre. Ça me parut très long.', ['farris', 'Premier avertissement. Au troisième, c\'est le shérif qui vient. Bonne journée.']] },
      ], prompt: 'Il manque de l\'argent.' },
    ]),
  ];
  T.d5Photo = [
    'L\'après-midi, M. Whitcomb arriva avec son grand appareil en bois sur l\'épaule et un trépied sous le bras.',
    ['whitcomb', 'Bonjour, madame Caudill. Je suis venu comme convenu.'],
    ['kenneth', 'Je serai pas sur la photo.'],
    ['kenneth', 'J\'ai pas besoin qu\'on me montre dans un journal pour que les gens de Chicago disent : « Pauvres gens. »'],
  ];
  T.d5PapaChoice = [
    { c: [
      { t: '« C\'est pas pour le journal, Pap\'. C\'est pour M\'man. »', set: { papaPersuaded: true }, then: [['kenneth', '…'], ['ida', 'Kenneth. Une fois. Une seule fois dans ma vie.'], 'Papa regarda M\'man très longtemps. Puis il remit son chapeau droit et sortit sur le perron.', ['kenneth', 'Une fois.']] },
      { t: '« Alors reste dedans. »', mood: { kenneth: -0.2 }, then: [['kenneth', 'C\'est ça.'], 'Il rentra et ferma la porte derrière lui.'] },
      { t: 'Ne rien dire', silent: true, then: ['Je ne dis rien. M\'man non plus. Papa rentra dans la maison.'] },
    ], prompt: 'Papa est sur le seuil.' },
  ];
  T.d5WhitcombPays = [
    'M. Whitcomb glissa un dollar dans la main de M\'man. Elle voulut le rendre. Il fit semblant de ne pas comprendre.',
  ];

  // ================================================================ FIN
  T.end8 = [
    'C\'est la seule photo où nous sommes huit.',
    'Je l\'ai encore. Elle est sur ma table de nuit. Et chaque soir, avant d\'éteindre, je compte.',
  ];
  T.end7 = [
    'Sur la seule photo de nous, il y a un trou, à côté de M\'man. Papa est resté derrière la porte.',
    'Je crois qu\'il l\'a regretté toute sa vie. Moi aussi.',
  ];
  T.teaser = 'Prochain épisode · Le charbon des voies (décembre 1932)';

  // Crochets que l'épisode remplit (transfert de bol pendant la table, etc.).
  T.hooks = { transfer: () => {} };
})();
