export type Persona =
  | 'naschkatze' | 'gesund' | 'hipster' | 'oma' | 'kind' | 'business' | 'tourist' | 'influencer' | 'student';

export const PERSONA_LABEL: Record<Persona, string> = {
  naschkatze: 'Naschkatze',
  gesund: 'Fitness-Fan',
  hipster: 'Hipster',
  oma: 'Rentner:in',
  kind: 'Kind',
  business: 'Business-Mensch',
  tourist: 'Tourist:in',
  influencer: 'Influencer:in',
  student: 'Student:in',
};

export const FIRST_NAMES = [
  'Herbert', 'Gisela', 'Kevin', 'Chantal', 'Jonas', 'Mia', 'Lukas', 'Emma', 'Brenda', 'Tony', 'Maria', 'Jamal', 'Priya',
  'Olga', 'Sven', 'Frieda', 'Bruno', 'Lotte', 'Mehmet', 'Aylin', 'Hank', 'Dolores', 'Vinnie', 'Rosa', 'Kai', 'Nele',
  'Jürgen', 'Ursula', 'Chen', 'Yuki', 'Pedro', 'Ingrid', 'Benny', 'Sophie', 'Marlon', 'Greta', 'Ahmed', 'Lina', 'Otto',
  'Paula', 'Theo', 'Hilde', 'Moritz', 'Zoe', 'Rudi', 'Carla', 'Finn', 'Wanda', 'Elvis', 'Trudi',
];

export const LINES: Record<Persona, Record<string, string[]>> = {
  naschkatze: {
    enter: ['Ich rieche Schokolade!', 'Mein Zahnarzt muss das nicht wissen.', 'Zucker ist auch ein Gemüse, oder?'],
    order: ['Alles drauf, was geht!', 'Extra süß, bitte!', 'Ich nehm das hier. Und das. Und DAS.'],
    happy: ['Zuckerschock, ich komme!', 'Himmlisch!!', 'Das ist mein Lieblingsladen!'],
    wrong: ['Hä? Wo sind meine Toppings?', 'Das ist ja fast gesund!', 'Das hab ich nicht bestellt…'],
    wait: ['Mein Blutzucker sinkt…', 'Ich kann den Joghurt schon hören…', 'Schneller, bitte!'],
    chat: ['Hast du die Gummibärchen probiert?', 'Ich könnte das jeden Tag essen.', 'Nachschlag?'],
  },
  gesund: {
    enter: ['Hab heute schon 20.000 Schritte!', 'Hat das hier Protein?', 'Cheat Day, Baby!'],
    order: ['Mit Obst, bitte. Viel Obst.', 'Nicht zu süß, ja?', 'Hat das Bio-Siegel?'],
    happy: ['Perfekt für meine Makros!', 'Sehr ausgewogen!', 'Superfood-Level!'],
    wrong: ['Das ist ja reiner Zucker!', 'Das passt nicht in meinen Plan!', 'Falsch! Ich zähle Kalorien!'],
    wait: ['Ich mach schon mal Kniebeugen…', 'Dauert das noch? Mein Puls sinkt.', 'Meine Smartwatch sagt: zu lange.'],
    chat: ['Morgen geh ich Laufen. Vielleicht.', 'Kokos ist total basisch.', 'Ich mach jetzt Yoga. Auf Insta.'],
  },
  hipster: {
    enter: ['Ich war hier, bevor es cool war.', 'Nice, voll analog hier.', 'Gibt es Hafer-Optionen?'],
    order: ['Irgendwas, das noch keiner kennt.', 'Matcha, aber ironisch.', 'Klein, aber artisanal.'],
    happy: ['Sehr authentisch.', 'Das kommt in meinen Blog.', 'Okay, das ist tatsächlich gut.'],
    wrong: ['Das ist so Mainstream.', 'Nee, das ist nicht mein Vibe.', 'Falscher Vibe, Bro.'],
    wait: ['Ich schreib solange einen Roman.', 'Zeit ist ein Konstrukt…', 'Läuft hier Vinyl?'],
    chat: ['Mein Bart hat eigene Follower.', 'Ich hör nur noch Kassetten.', 'Das Licht hier ist sehr kinematisch.'],
  },
  oma: {
    enter: ['Ach, wie hübsch hier!', 'Früher gab es so was nicht.', 'Junge, hast du was gegessen?'],
    order: ['Eine Waffel, wie früher, bitte.', 'Was ist denn ein Topping?', 'Mit Sahne, mein Schatz.'],
    happy: ['Du bist ein Goldschatz!', 'Wie bei Muttern!', 'Hier, für dich, Kleines.'],
    wrong: ['Das war aber nicht bestellt, Kind.', 'Na, na, na!', 'Ich sag nix. Aber ich denk mir was.'],
    wait: ['Ich hab ja Zeit…', 'Ich strick solange.', 'Zu meiner Zeit ging das schneller.'],
    chat: ['Hast du schon gehört, die Müllers…', 'Noch ein Käffchen?', 'Mein Enkel studiert jetzt Influencer.'],
  },
  kind: {
    enter: ['Mamaaa, Eis!!', 'WOOOW!', 'Ich will alles!'],
    order: ['Mit Gummibärchen! Und Streuseln!', 'Rosa! Alles rosa!', 'Das größte!'],
    happy: ['JAAAA!', 'Bestes Eis der Welt!', 'Ich mal dir ein Bild!'],
    wrong: ['Bäh!', 'Das ist ja ekelig!', 'Ich wollte das ANDERE!'],
    wait: ['Wann ist es fertig?', 'Mir ist langweilig…', 'Ist es jetzt fertig?'],
    chat: ['Ich hab einen Wackelzahn!', 'Kann ich noch eins?', 'Ich bin ein Dinosaurier! RAWR!'],
  },
  business: {
    enter: ['Ich hab 5 Minuten.', 'Kurzer Call, dann Joghurt.', 'Synergie-Snack.'],
    order: ['Schnell, bitte.', 'Was ist am effizientesten?', 'Wie immer. Ach nee, ich war nie hier.'],
    happy: ['Solide Performance!', 'Ich empfehle euch im Meeting.', 'KPI: erfüllt.'],
    wrong: ['Das eskaliere ich.', 'Das ist ein Prozessfehler.', 'Ich will den Manager sprechen.'],
    wait: ['Zeit ist Geld!', 'Ich verpasse mein Meeting…', 'Hallo? Service?'],
    chat: ['Lass uns das offline besprechen.', 'Wir müssen agiler snacken.', 'Ich bin ab Montag im Sabbatical.'],
  },
  tourist: {
    enter: ['Is this the famous New York Froyo?', 'Foto! Alle mal lächeln!', 'Wie im Film hier!'],
    order: ['Ich nehme das Typische!', 'One Froyo, please! Äh, bitte!', 'Was empfehlen Sie?'],
    happy: ['Amazing! Wunderbar!', 'Das erzähle ich zuhause!', 'Fünf Sterne auf TripAdvisor!'],
    wrong: ['Hmm, that is not… richtig?', 'Ist das hier so üblich?', 'Lost in translation…'],
    wait: ['Ich mach solange Fotos.', 'Wo ist die Freiheitsstatue?', 'Nimmt der Laden Reiseschecks?'],
    chat: ['Morgen Empire State Building!', 'Die Taxis sind sooo gelb!', 'Ich hab 3000 Fotos gemacht.'],
  },
  influencer: {
    enter: ['Hey Leute, heute bin ich in…', 'Das Licht hier! OMG!', 'Link in Bio!'],
    order: ['Was Hübsches für die Story!', 'Pastell, bitte!', 'Kann man das auch in ästhetisch?'],
    happy: ['Content-Gold!', '#froyo #blessed', 'Meine Follower werden ausrasten!'],
    wrong: ['Das kann ich nicht posten!', 'Das passt nicht zu meinem Feed!', 'Unfollow.'],
    wait: ['Mein Akku ist bei 3 Prozent…', 'Ich mach solange ein Selfie.', 'Live-Stream läuft, beeil dich!'],
    chat: ['Noch ein Foto, dann ess ich!', 'Wie war das WLAN-Passwort?', 'Das war gesponsert, oder?'],
  },
  student: {
    enter: ['Gibt es Studentenrabatt?', 'Lernpause!', 'Ich hab noch 4,20 €.'],
    order: ['Das Günstigste, bitte.', 'Ein Topping reicht. Oder zwei.', 'Zahl ich mit Pfand?'],
    happy: ['Rettet meinen Tag!', 'Besser als Mensa!', 'Ich komm wieder. Mit Freunden!'],
    wrong: ['Hab ich das bestellt? Nee.', 'Das ist wie meine Klausur. Falsch.', 'Hmpf.'],
    wait: ['Ich hab gleich Vorlesung…', 'Ich lern solange Vokabeln.', 'Mein Bafög läuft ab…'],
    chat: ['Morgen ist Abgabe. Wird schon.', 'Ich mach Philosophie. Warum?', 'Kennst du Netflix-Serien?'],
  },
};

export const GENERIC = {
  noSeat: ['Kein Platz?! Dann eben to go.', 'Wo soll man sich hier hinsetzen?', 'Nicht mal ein Stuhl frei…'],
  queueFull: ['Oh, viel zu voll hier…', 'Die Schlange ist ja ewig!', 'Ein andermal vielleicht.'],
  expensive: ['Ganz schön teuer hier…', 'Puh, die Preise!', 'Ist das in Gold?'],
  cheap: ['Was für ein Schnäppchen!', 'So günstig!', 'Da kann man nicht meckern!'],
  leaveAngry: ['Ich geh! Ich will mein Geld zurück!', 'Unmöglich hier!', 'Das dauert mir zu lange!'],
  outOfStock: ['Nichts mehr da?! Na toll.', 'Leere Regale…', 'Kommt ihr mal wieder zum Einkaufen?'],
  drink: ['Ich nehm mir noch was zu trinken.', 'Erfrischung!', 'Eine Limo geht immer.'],
  reorder: ['Ich hol uns noch was!', 'Noch eine Runde?', 'Ich brauch noch einen Kaffee.'],
  pedestrian: [
    'Taxi! TAXI!', 'Hast du das gesehen?', 'Nur noch ein Block…', 'Ich bin spät dran!', 'Schönes Wetter heute!',
    'Ist das ein neuer Laden?', 'Hey, Frozen Yogurt!', 'Mein Hund mag Eis.', 'Fuhgeddaboudit!', 'Ich lauf hier!',
  ],
  spill: ['Hoppla!', 'Upsi…', 'Oh nein, gekleckert!', 'Huch, das tropft!'],
  sticky: ['Igitt, hier klebt’s!', 'Bäh, wer hat hier gekleckert?', 'Vorsicht, rutschig!'],
  dirty: ['Ziemlich schmuddelig hier.', 'Die Tische waren alle dreckig…', 'Lecker, aber putzt mal!', 'Überall Kleckse. Schade.'],
  dirtyTables: ['Alles voller Geschirr – wo soll man sitzen?', 'Räumt hier keiner ab?'],
  cozyHigh: ['Wie gemütlich es hier ist!', 'So schön eingerichtet!', 'Hier fühl ich mich wohl.'],
  photo: ['*klick* Für die Story!', '*Blitz*', 'Einmal lächeln, Joghurt!'],
};

export const THIEF = {
  enter: ['Pssst… niemand guckt…', 'Nur ein kleiner Snack…', 'Hehehe…'],
  steal: ['*knusper*', 'Mjam!', '*schmatz*', 'Die nehm ich mit!', 'Hehe!'],
  slapped: ['AUA! Schon gut, schon gut!', 'Mein Händchen!', 'Ich komme wieder!', 'Uff! Mit dem Löffel?!'],
  escaped: ['Haha! Erwischt mich doch!', 'Danke für die Toppings!', 'Bis morgen!'],
};

export const STAFF_LINES = {
  idle: ['Alles im Griff, Chef!', 'Ich wisch mal kurz.', 'Schöner Tag heute.', 'Noch jemand Joghurt?'],
  take: ['Was darf es sein?', 'Hallo! Herzlich willkommen!', 'Ich nehm das auf!'],
  done: ['Bitteschön!', 'Lasst es euch schmecken!', 'Einmal frisch gemacht!'],
  oops: ['Ups…', 'Oh nein, verwechselt!', 'Huch!'],
};

export const PLAYER_LINES = {
  slap: ['Finger weg!', 'Nicht mit mir!', '*KLATSCH*', 'Löffel der Gerechtigkeit!'],
  noStock: ['Leer! Ich muss nachbestellen.', 'Da ist nix mehr drin…'],
};

export const STAFF_NAMES = [
  'Lea', 'Tim', 'Ronja', 'Mats', 'Jule', 'Deniz', 'Ole', 'Hanna', 'Nico', 'Elif', 'Bo', 'Klara', 'Raul', 'Ines', 'Fiete', 'Momo',
];
export const STAFF_TRAITS = [
  'hat mal in einer Eisdiele in Rimini gearbeitet',
  'kann mit verbundenen Augen Streusel zählen',
  'ist sehr freundlich, aber etwas verträumt',
  'hat drei Barista-Kurse gemacht',
  'redet gerne mit den Gästen',
  'ist superschnell, wenn Musik läuft',
  'liebt Waffeln mehr als Menschen',
  'war früher Jongleur:in im Zirkus',
  'macht nebenbei eine Ausbildung zum Konditor',
  'hört nur Lo-Fi-Beats',
];
