# Translation review guide

The app is translated into Amharic (am), Arabic (ar), Afaan Oromoo (om) and Somali (so) from English (en).
The translations were produced carefully from a terminology study, but **no native speaker has reviewed them yet**.
Please have a native speaker of each language go through the notes below before real schools use the app.

## How to review and edit

- Texts live in `src/i18n/messages/<language>/<area>.json` (e.g. `am/teacherAttendance.json`). Compare with the same file in `en/`.
- Change only the text. Keep everything in curly braces exactly as it is: `{name}`, `{count}`, `#`, and the words `plural`, `select`, `one`, `other`, `female`, etc.
- After editing, run `node scripts/i18n-sync.mjs --check`; it must print "All translations complete."
- Parent SMS texts are in `src/lib/smsMessage.ts` (one template per language).
- Each section below starts with the term list the translator used, then the specific points to check first.


---

---


---

## Amharic (am) translation review

Namespaces done: common, nav, requests

### Term list (English -> Amharic)

| English | Amharic | Note |
|---|---|---|
| Khendeq (appName) | Khendeq (kept Latin) | SMS uses ኸንደቅ መድረሳ; reviewer may prefer ኸንደቅ for am UI |
| school | ትምህርት ቤት (ቤቱ when definite) | |
| platform | መድረክ | |
| school admin | የትምህርት ቤት አስተዳዳሪ; in sentences የትምህርት ቤቱ አስተዳዳሪ / አስተዳዳሪው | |
| platform admin (superadmin) | የመድረክ አስተዳዳሪ | |
| teacher / teachers | መምህር / መምህራን (ለመምህሩ = to the teacher) | ኡስታዝ not used in generic UI |
| student / students | ተማሪ / ተማሪዎች | masculine-generic ተማሪው when gender unknown |
| class | ክፍል / ክፍሎች | |
| section | ሴክሽን | |
| attendance | መገኘት (records: የመገኘት መዝገብ) | |
| take attendance | መገኘት መዝግብ | alt: ስም ጥሪ |
| results | ውጤቶች | ውጤት avoided for "search results" |
| exams | ፈተናዎች | |
| reports | ሪፖርቶች | |
| request | ጥያቄ | |
| pending | በመጠባበቅ ላይ | |
| approve / approved | አጽድቅ / ጸድቋል (question: ይጽደቅ?) | |
| reject / rejected | ውድቅ አድርግ / ውድቅ ተደርጓል | |
| withdraw (request), cancelled | ጥያቄውን አንሳ / ተነስቷል | not ሰርዝ (=delete) |
| cancel (button) | ይቅር | |
| delete / deleted | ሰርዝ / ተሰርዟል; Deleted students = የተሰረዙ ተማሪዎች | |
| permanently delete | እስከመጨረሻው ሰርዝ | |
| restore | ወደነበረበት መልስ | bare መልስ also means "answer" |
| move/transfer (student to class) | አዛውር / ማዛወር / ዝውውር; passive ይዛወራል / ተዛውሯል | |
| reason | ምክንያት | |
| note | ማስታወሻ | |
| actions (column/menu) | ተግባራት | |
| history | ታሪክ | |
| dashboard | ዳሽቦርድ | |
| settings | ቅንብሮች | |
| profile | መገለጫ | |
| sign out | ውጣ | |
| notifications | ማሳወቂያዎች | |
| menu | ምናሌ | |
| export | ወደ ፋይል አውጣ (CSV: ወደ CSV አውጣ) | |
| edit | አስተካክል | |
| required | ግዴታ (error: ይህን መሙላት ግዴታ ነው።) | |
| active / inactive / suspended | ንቁ / የቦዘነ / የታገደ | |
| loading / saving / saved | በመጫን ላይ… / በማስቀመጥ ላይ… / ተቀምጧል | |
| optional | አማራጭ | |

Conventions: buttons use the short neutral imperative (አስቀምጥ, ሰርዝ); prose uses polite እርስዎ forms (ይምረጡ, ይችላሉ, ላኳቸው). When a placeholder is a name, I avoided attaching case suffixes to it (e.g. "የመሰረዝ ጥያቄ፦ {name}" rather than "{name}ን ..."). Prefixes ከ/በ/ወደ are attached before {from}, {className} and {name}, which is normal.

### Strings to double-check

1. common.status.cancelled "ተነስቷል" and requests.teacher.cancelRequest "ጥያቄውን አንሳ": these mean withdrawing a request. Is "ተነስቷል" clear on a status chip by itself, or would a reviewer prefer "ተሰርዟል"? (I avoided that because it collides with delete.)
2. common.actions.restore / requests.deleted.restore "ወደነበረበት መልስ": this is long for a table button. Is "መልስ" alone too ambiguous because it also means "answer"?
3. nav.attendance "መገኘት" and nav.takeAttendance "መገኘት መዝግብ": formal wording. Many schools say "ስም ጥሪ" or "አቴንዳንስ" aloud, so please confirm what teachers recognise in a sidebar.
4. requests.dialog.deleted, approveDeleteEffect, approveTransferEffect, restored, purged: these use masculine-generic verbs (ተዛውሯል, ይዛወራል, ተመልሷል, ተሰርዟል) after {name}, because the string has no gender argument. For a girl, they would read ተዛውራለች and so on. Consider adding a gender select later.
5. requests.dialog.deleteDescription and transferDescription, and requests.admin.rejectEffect: these use "ተማሪው" and "መምህሩ" (masculine definite) as generic forms. Please confirm this is acceptable.
6. requests.admin.reviewedBy "በ{name} {status} · {date}": {status} is filled with common.status values (ጸድቋል / ውድቅ ተደርጓል), giving e.g. "በአሕመድ ጸድቋል · ...". Check that the code really passes the translated status here.
7. requests.reasons.*: these are written as past-tense statements (ተዛውሯል, አቋርጧል, አጠናቋል), masculine-generic. "ቤተሰቡ ወደ ሌላ አካባቢ ሄዷል" stands for "Family moved away". Should they be verbal nouns instead (መዛወር, ማቋረጥ)?
8. requests.admin.from / to "ከ ክፍል" / "ወደ ክፍል": column labels; I added ክፍል because bare ከ / ወደ cannot stand alone.
9. requests.dialog.detailsPlaceholder: I adapted the example to the Ethiopian calendar ("መጋቢት 3 ቀን").
10. common.pagination.showing "ከ{total} ውስጥ {from}–{to}" and page "ገጽ {page} ከ{pages}": please check these read naturally.
11. common.actions.showLess "ጥቂት አሳይ" and previous "ቀዳሚ": "ያነሰ አሳይ" and "ያለፈው" are possible alternatives.
12. common.roles.superadmin "የመድረክ አስተዳዳሪ": the glossary gives "የመድረክ ዋና አስተዳዳሪ". I shortened it for the sidebar.
13. nav.sections.academics "ትምህርት": very general. "የትምህርት ጉዳዮች" is an alternative.

---

# Batches 2–6 (requests update, teacher*, admin*, dates, exams, notifications, landing, auth, profile, superadmin, adminSettings, students)

Status: `node scripts/i18n-sync.mjs --check` shows 0 lines for `am`. I also added `common.errors.api.*`, a set of keys that appeared in English after batch 1.

### Updates to earlier notes
- Notes 4 and 6 above are fixed. requests `deleted`, `approveDeleteEffect`, `approveTransferEffect`, `restored` and `purged` now use `{gender, select}` with real feminine forms: ተዛውራለች, ትዛወራለች, መዝገቧና ውጤቶቿ, ወደነበረችበት, ተመልሳለች, ተሰርዛለች. `reviewedBy` is now a `{status, select}`: approved gives "በ{name} ጸድቋል", rejected gives "በ{name} ውድቅ ተደርጓል", other gives "በ{name} ታይቷል".
- "Grade" is now always ደረጃ: teacherClasses.classCard.grade "ደረጃ {grade}", adminDashboard classes.table.grade, adminClasses form.grade and certificate nextGrade. This matches the certificate artwork, where ደረጃ labels the class.

### Additional terms
| English | Amharic |
|---|---|
| roll number / short column | ተራ ቁጥር / ተ.ቁ. ("ተ.ቁ. {roll}") |
| present / absent / late / excused (chips) | የተገኘ / ቀሪ / ያረፈደ / በፈቃድ |
| not marked | ያልተመዘገበ |
| all present (bulk button) | ሁሉም ተገኝተዋል |
| record(s) | መዝገብ / መዝገቦች |
| parent phone / alternative phone | የወላጅ ስልክ / ተጨማሪ ስልክ |
| my classes / my students | የእኔ ክፍሎች / የእኔ ተማሪዎች ("All my classes" = ሁሉም ክፍሎቼ) |
| assign (teacher to class) | መድብ / ተመድቧል; unassigned = ያልተመደበ |
| registration | ምዝገባ |
| account | መለያ |
| user(s) | ተጠቃሚ(ዎች) |
| activate / deactivate | አንቃ / አቦዝን (ነቅቷል / ቦዝኗል) |
| suspend (school) | አግድ / ታግዷል |
| mid exam / assignment / final exam | የአጋማሽ ፈተና / የቤት ሥራ / የማጠቃለያ ፈተና |
| marks / maximum marks | ውጤት / ሙሉ ውጤት |
| total / grand total / average / rank | ድምር / አጠቃላይ ድምር / አማካይ / ደረጃ |
| overall result | አጠቃላይ ውጤት |
| draft | ረቂቅ |
| sheet (exam/result sheet) | ሉህ |
| subject | የትምህርት ዓይነት |
| certificate | የምስክር ወረቀት |
| promoted / not promoted | የተዛወረ / ያልተዛወረ |
| academic year | የትምህርት ዘመን |
| Ethiopian calendar | የኢትዮጵያ አቆጣጠር; era suffix ዓ.ም |
| absence alerts | የቀሪ ማሳወቂያዎች |
| attendance reminders | የመገኘት አስታዋሾች |
| announcement / publish | ማስታወቂያ / ይፋ አድርግ (not አትም, which means print) |
| import (CSV) / template | አስገባ / ቅጽ |
| row / column | ረድፍ / አምድ |
| characters (password length) | ፊደላት |

### Strings to double-check
14. **dates.format.long** "{month} {day} ቀን {year}" and **withEra** "{date} ዓ.ም": this follows the "መስከረም 5 ቀን 2018 ዓ.ም" convention. Check how it renders in the UI. The month spellings are copied from ethiopianDate.ts (ህዳር, ታህሳስ, ሐምሌ, ነሐሴ, ጳጉሜ).
15. **Status chips** (present/absent/late/excused): the glossary forms የተገኘ / ቀሪ / ያረፈደ / በፈቃድ. On a teacher's marking buttons, "ተገኝቷል / ቀርቷል" might feel more natural; please confirm.
16. **exams.types.assignment** "የቤት ሥራ": schools also say "ተግባር" or "አሳይመንት" for continuous assessment. I avoided ተግባር because it already means "Actions" in this UI.
17. **exams.table.rank** "ደረጃ" now means both rank and grade/level. They never appear in the same table, but a reviewer may prefer "የክፍል ደረጃ" for rank.
18. **exams.certificate.subjects**: ሲራ, ዐቂዳ, ሐዲስ, ዚክር, ዐረብኛ, ፊቅህ, and the placeholder ተጅዊድ. Please check these against the spellings the medresah uses (e.g. አቂዳ/ዓቂዳ, አረብኛ, ሐዲሥ). **exams.csv.overallFile** stays the ASCII filename "overall-result" so downloads are safe.
19. **promoted / notPromoted** "የተዛወረ / ያልተዛወረ": please confirm. The certificate shows the next grade next to the word "ወደ".
20. **adminDashboard.charts.teacherLabel** and **students.detail.ustaz** "ኡስታዝ {name}": a female teacher would be ኡስታዛ, so a gender select would be needed. For **notifications.reminders.adminLine** I did not add ኡስታዝ, because it would force male. The polite plural verb "{teacher} ... አልመዘገቡም" is respectful and gender-neutral.
21. **auth / notifications.install iOS steps**: the iOS button names stay in English ("Share", "Add to Home Screen", "Add") because iOS has no Amharic interface. In auth.errors.network, "ad blocker, VPN, proxy" also stay in Latin script.
22. **adminSettings.academicYearPlaceholder / adminClasses.yearPlaceholder** "2026-2027": kept as in English (Gregorian), but the certificate uses EC years (e.g. 2017). Decide whether the placeholder should show an EC example ("2018").
23. **adminClasses.form.namePlaceholder** "5ኛ ክፍል" and **sectionPlaceholder** "ሀ": these are adapted Ethiopian examples (English uses "Grade 5" / "A").
24. **adminStudents.csv.\*** (import headers): ስም, ተራ ቁጥር, ጾታ, ዕድሜ, ክፍል, የክፍል ስም, ሴክሽን, የወላጅ ስልክ, ተጨማሪ ስልክ, የወላጅ ቋንቋ. They are short and have no commas. Please test that the importer matches these exact strings.
25. **Suffix ን on placeholders**: e.g. "{name}ን አስተካክል", "{title}ን አትም", "{subject}ን አስወግድ". It reads fine for Ethiopic names but looks odd after Latin-script names or file names. For file names I used "ክፈት፦ {name}" instead.
26. **adminTeachers.delete.title** "{name} ይሰረዙ?": the honorific plural treats the user as a person. Elsewhere I used impersonal forms such as "የ{name} መለያ ተሰርዟል".
27. **notifications.absence.dismiss** "እንደተደወለ ምልክት አድርግና አስወግድ ({count})": this is long for a button. A shorter option is "ተደውሏል ({count})".

---

# Terminology change: madrasa / ustaz (owner's decision)

96 strings in 21 namespaces were changed. Keys, placeholders and plural/select blocks are unchanged.

| Old | New |
|---|---|
| ትምህርት ቤት / ቤቱ / ቤቱን / ቤትዎ / ቤትዎን / ቤቶች / ቤቶችን | መድረሳ / መድረሳው / መድረሳውን / መድረሳዎ / መድረሳዎን / መድረሳዎች / መድረሳዎችን |
| የትምህርት ቤት(ቱ) አስተዳዳሪ | የመድረሳ(ው) አስተዳዳሪ |
| መምህር / መምህሩ / መምህሩን | ኡስታዝ / ኡስታዙ / ኡስታዙን |
| መምህራን / መምህራንን / መምህራኑ | ኡስታዞች / ኡስታዞችን / ኡስታዞቹ |

These were not changed:
- የትምህርት ዘመን (academic year)
- የትምህርት ዓይነት (subject)
- ትምህርት አቋርጧል (dropped out)
- nav.sections.academics "ትምህርት"
- the platform word መድረክ

None of the changed strings is clearly about a female ustaz, so ኡስታዛ is not used anywhere.

Reviewer check:
28. The plural ኡስታዞች. Some communities say ኡስታዞች, others use the Arabic-style plural (e.g. አሳቲዝ). መድረሳዎች as the plural of madrasa should be confirmed too.
29. A few verbs and adjectives now agree with ኡስታዙ (masculine). Examples: adminExams.list.emptyHint "ኡስታዙ ውጤቱን ካስቀመጠ በኋላ" and requests.admin.rejectEffect "ኡስታዙ ማስታወሻዎን ያያል". Both are generic masculine, as before.

---

# Rebrand to MMS and per-madrasa branding

What changed:
- common.appName is now "MMS".
- appTagline and the landing footer now read "የመድረሳ አስተዳደር ሥርዓት". I also changed adminSettings ስርዓቱ to ሥርዓቱ so the spelling is consistent.
- The install strings use {app}.
- landing has no Khendeq left.
- The name-field placeholders still give "ኸንደቅ መድረሳ" as an example, because the English source keeps "Khendeq Medresah" there.

New terms:

| English | Amharic |
|---|---|
| branding | ስምና አርማ (page title: የመድረሳው ስም፣ አርማ እና ሊንክ) |
| link / link name | ሊንክ / የሊንክ ስም |
| logo / default logo | አርማ / ነባሪ አርማ |
| app icon | የመተግበሪያ አዶ |
| staff | ሠራተኞች |
| Appearance / Light / Dark / Device setting | ገጽታ / ብሩህ / ጨለማ / የመሣሪያው ቅንብር |

Reviewer check:
30. auth.poweredBy "የሚሠራው በMMS — የመድረሳ አስተዳደር ሥርዓት": check the word order.
31. notifications.install.descriptionIos "{app}ን ...": this adds the ን case ending to an app name that may be in Latin script (see note 25).
32. branding.slugHint / slugInvalid: these say "ትንንሽ የእንግሊዝኛ ፊደላት" (lowercase English letters) to make it clear that Latin letters are required.
33. Theme labels ብሩህ / ጨለማ: "ፈካ ያለ" is a possible alternative to ብሩህ.

---

## Arabic (ar): term list and review notes

All 26 namespaces are translated. `node scripts/i18n-sync.mjs --check` reports 0 `ar` lines, and all 1,199 ar messages parse with intl-messageformat.

### Term list (English → Arabic)

| English | Arabic | Notes |
|---|---|---|
| MMS (brand) | MMS — نظام إدارة المدارس الإسلامية | Latin "MMS"; Khendeq now appears only as the example school name |
| school | مدرسة | |
| platform | المنصّة | |
| student / students | طالب / الطلاب; female: طالبة / الطالبات | Masculine plural for mixed groups |
| teacher (Ustaz) / teachers | أستاذ / الأساتذة (female: الأستاذة) | Owner decision: replaces معلّم everywhere |
| school admin | مسؤول المدرسة (short: المسؤول) | Not مدير, not أدمن |
| platform admin | مسؤول المنصّة | |
| user(s) | المستخدمون | |
| class | الفصل (pl. الفصول) | Teaching group |
| grade level | الصف | Used only for grade level, e.g. classCard.grade "الصف {grade}" |
| section | الشعبة (pl. الشعب) | |
| semester | الفصل الدراسي | Always written in full; mid exam avoids it (see below) |
| academic year | العام الدراسي | |
| roll number | الرقم التسلسلي (column header: الرقم; chip: رقم {roll}) | |
| attendance | الحضور والغياب (short: الحضور) | |
| take / mark attendance | تسجيل الحضور | |
| present / absent / late / excused | حاضر / غائب / متأخّر / غائب بعذر | Column header for excused: بعذر |
| absence (count noun) | حالة غياب; record: سجل غياب | |
| attendance history | سجل الحضور | |
| history (tab) | السجل | |
| record(s) | سجل / سجلات | |
| exam | امتحان | |
| mid / assignment / final | الامتحان النصفي / الواجبات / الامتحان النهائي | |
| mark / marks | الدرجة / الدرجات | |
| maximum marks | الدرجة العظمى | |
| total / grand total | المجموع / المجموع الكلي | |
| average / class average | المعدل / معدل الفصل | |
| rank | الترتيب | |
| subject | المادة | |
| result sheet | كشف (النتائج) | |
| overall result | النتيجة الإجمالية | |
| certificate | الشهادة | |
| promoted / not promoted | منقول / غير منقول | |
| request(s) | طلب / الطلبات | |
| pending | قيد الانتظار | |
| approve / approved | موافقة / مقبول | |
| reject / rejected | رفض / مرفوض | |
| withdraw (request) | سحب الطلب | |
| deleted students | الطلاب المحذوفون | |
| restore | استعادة | |
| permanently delete | حذف نهائي | |
| move / transfer | نقل | |
| assign (classes) | إسناد / مُسنَد | |
| parent / guardian | وليّ الأمر | No shadda in CSV headers: ولي الأمر |
| alternative phone | هاتف بديل | |
| announcement | إعلان | |
| notification / alert | إشعار / تنبيه | |
| reminder | تذكير | |
| import / export / upload / download | استيراد / تصدير / رفع / تنزيل | تحميل is used only in "loading" |
| CSV row | سطر (pl. أسطر) | صف avoided because it clashes with grade |
| template (CSV) | نموذج | |
| activate / deactivate | تفعيل / إيقاف التفعيل | |
| suspend (school) | إيقاف / موقوف | |
| registration (student) | تسجيل الطلاب | |
| dashboard / settings / profile | لوحة التحكم / الإعدادات / الملف الشخصي | |
| sign in / sign out | تسجيل الدخول / تسجيل الخروج | |
| password | كلمة المرور | |
| Ethiopian calendar | التقويم الإثيوبي | |
| Message patterns | تم … بنجاح / تعذّر … / يُرجى … | |
| Placeholders | masculine imperative (اختر، ابحث، اكتب) | Placeholders only; buttons use verbal nouns |

### Strings a native reviewer should check

### Grammar and plurals
1. **Plurals (all six CLDR forms).** I spot-checked the output, e.g. 0 لا يوجد طلاب, 1 طالب واحد, 2 طالبان, 3 طلاب, 11 طالبًا, 100 طالب, 103 طلاب. Please check these in particular:
   - The `few` forms for sound masculine plurals: # معلّمين, # مسؤولين, # طلاب نشطين.
   - The `many` forms written with tanween or shadda: سجلًّا, درجةً, سنةً, تنبيهًا.
   - The `many` forms written as an idafa with no tanween: "# يوم غياب" and "# سجل غياب". Some reviewers may prefer "# يومًا".
2. **Accusative dual where the noun is the object of إضافة/استيراد/تخطّي:** طالبَين, سطرَين, رقمَي هاتف, سجلَّي غياب. The nominative is used elsewhere (طالبان، سطران).
3. **Gender selects in `requests` (batch 2).**
   - The female branches use نُقلت / ستُنقل / أُعيدت / حُذفت and حضورها / استعادتها; `other` is masculine.
   - `admin.reviewedBy` now reads "وافق عليه {name}" / "رفضه {name}" / "راجعه {name}". The pronoun refers to الطلب.
4. **Still masculine-generic, with no gender argument available:**
   - `requests.reasons.*` (انتقل، انقطع، أتمّ)
   - `adminDeleteDescription` (استعادته)
   - `notifications.absence.empty`
   - status chips (حاضر/غائب)
   - "الأستاذ {name}" in `adminDashboard.charts.teacherLabel` and `students.detail.ustaz`, which would be الأستاذة for a female teacher. The English is "Ustaz", which is masculine too.
5. **`notifications.reminders.adminLine`** is "{teacher}: لم يُسجَّل حضور اليوم بعد." I used the passive with a label prefix so the verb doesn't depend on the teacher's gender. "لم يسجّل الأستاذ {teacher} …" reads more naturally, but it would be wrong for a female teacher.
6. **Agreement-free rewrites for bare numeric placeholders.** These placeholders are not plural-formatted, so I reworded to avoid number–noun agreement:
   - `notifications.absence.description` and `.empty`: "بلغ عدد أيام غيابهم المتتالية {streak}"
   - `adminDashboard.kpi.totalHint`: "ذكور: {male} · إناث: {female}"
   - `requests.dialog.detailsTooShort`

### Terminology
7. **Mid exam = الامتحان النصفي** rather than the glossary's "امتحان منتصف الفصل". The glossary wording contains الفصل, which this app uses for "class".
8. **Assignment = الواجبات** (plural, as an exam-type label). تكليف is the alternative.
9. **promoted / not promoted = منقول / غير منقول** on the certificate. Some schools write ناجح / راسب or "ينقل إلى الصف …". Check this against the certificate layout.
10. **`exams.certificate.subjects.zikr` = الأذكار** (plural, the usual subject name). الذكر is the alternative.

### Dates (`dates.json`)
11. **Ethiopian month names.** I chose: مسكرم، طقمت، هدار، تاهساس، طر، يكاتيت، مجابيت، ميازيا، جنبوت، سني، هملي، نهاسي، باجمي. No single Arabic standard exists. The uncertain ones:
   - **Month 2:** I used طقمت (ط for the ejective ጥ, matching طر). The coordinator's suggestion was تقمت, and the variant تكمت also occurs.
   - **Month 11:** I used هملي, which is consistent with هدار and reflects that Amharic ሐ is pronounced h. The coordinator suggested حملي.
   - **Month 13:** باجمي is also written باجومي.
   - **Others:** تاهساس / تهساس and جنبوت / جنبت also vary.
12. **Date formats.**
   - `format.long` and `format.short` are reordered to day–month–year ("{day} {month} {year}"), the Arabic order.
   - `format.withEra` = "{date} بالتقويم الإثيوبي". This is long, and no common Arabic abbreviation exists.

### CSV import and export
13. **`adminStudents.csv.class` and `csv.className` are both "الفصل" on purpose.**
   - The importer matches localized headers by exact text (`buildColumnMap` in src/app/admin/students/page.tsx), and its fallback heuristics only work on Latin a–z. The student export writes `csv.class`, while the importer expects `csv.className`.
   - Using the same label keeps the Arabic export re-importable. With "اسم الفصل", the class column would be lost.
   - CSV headers also leave out the shadda (ولي الأمر), so typed headers are more likely to match. The UI elsewhere uses وليّ.
   - Code-side concern for the developer: the template's example rows still use the English values `male`/`female` for gender.
14. **`exams.csv.overallFile` = "النتيجة-الإجمالية"** is used as a download filename. Switch it to Latin if any target system has trouble with Unicode filenames.

### Wording choices
15. **Error messages** (`auth.errors.*`, `common.errors.api.*`) use a calm "تعذّر … / يُرجى …" register. "ad blocker, VPN or proxy" became "أداة لحظر الإعلانات أو شبكة VPN أو خادم وكيل", and VPN stays in Latin because it is the familiar term.
16. **iOS install steps** use verbal nouns ("الضغط على زر «مشاركة» …") to stay gender-neutral. The quoted labels «مشاركة» and «إضافة إلى الشاشة الرئيسية» match the Arabic iOS UI.
17. **Landing hero title** is "إدارة مدرستك بالكامل من مكان واحد", a verbal-noun headline. A marketing reviewer may prefer the imperative أدِر.
18. **`landing.features.reports` "grades"** is translated as الدرجات (marks), not الصفوف. Confirm that the chart shows marks.
19. **`common.status.inactive` = غير نشط.** If the status means "disabled by an admin", معطّل fits better. Accounts use تفعيل / إيقاف التفعيل.
20. **Latin script inside RTL text.** The brand name "Khendeq", "CSV", "VPN", "Safari", sample emails and the phone placeholder stay in Latin and rely on bidi isolation in the UI.
21. **requests vs students.** الطلبات (requests) and الطلاب (students) look alike in the sidebar. This is standard Arabic but worth watching.
22. **`requests.dialog.detailsPlaceholder`** uses a Gregorian month ("12 مارس"), as the English does. An Ethiopian month name (e.g. 12 مسكرم) might suit these schools better.
23. **`adminClasses.form.sectionPlaceholder` "مثال: A"** keeps the Latin letter, since Ethiopian schools write sections that way. Arabic schools would use أ/ب.
24. **Terminology change (owner's decision): teacher → Ustaz.**
   - Every معلّم form was replaced with أستاذ / الأستاذ / الأساتذة, across 44 strings, including roles.teacher and the count plurals (أستاذ واحد / أستاذان / # أساتذة / # أستاذًا / # أستاذ).
   - Because الأساتذة is a broken plural, the old sound-plural case endings (معلّمون/معلّمين) are gone; ومعلّموها became وأساتذتها.
   - No string clearly refers to a woman, so الأستاذة is not used yet.
   - School stays المدرسة throughout. I did not add المدرسة الإسلامية anywhere because no sentence needed it.
   - Please check that "مسؤول المدرسة" still fits now that the English says "Madrasa admin".
25. **MMS rebrand.**
   - The full name of MMS is translated as "نظام إدارة المدارس الإسلامية". It appears in common.appTagline, auth.poweredBy and landing.footer.copyright.
   - إسلامية is the one place where I used the explicit Islamic form. This is the brand's own definition, and "نظام إدارة المدارس" alone would read as generic school software. If the owner prefers the shorter form, it changes in those 3 strings.
   - auth.poweredBy = "بدعم من MMS — …".
   - Branding is translated as الهوية البصرية, staff as العاملون, and the slug as اسم الرابط ("أحرف إنجليزية صغيرة", i.e. lowercase English letters).
   - The appNameHint wording "{max} من الأحرف" was chosen so the noun doesn't have to agree with the number.
   - The name placeholders ("مثال: مدرسة Khendeq" in adminSettings and superadmin) still mirror the English example school name.

---

## Afaan Oromoo (om) review notes

Namespaces done: common, nav, requests (batch 1); teacherDashboard, teacherAttendance, teacherClasses, teacherStudents, teacherHistory (batch 2); adminDashboard, adminAttendance, adminReports, dates (batch 3).
`node scripts/i18n-sync.mjs --check` reports nothing for om in these namespaces.

### Term list (English -> Oromo)

| English | Oromo | Note |
|---|---|---|
| School | Mana barumsaa (pl. Manneen barumsaa) | |
| Platform | Waltajjii | |
| Platform admin | Bulchaa waltajjii | |
| School admin / admin | Bulchaa mana barumsaa / Bulchaa | |
| Teacher(s) | Barsiisaa / Barsiisota | |
| Ustaz (chart label) | Ustaaz {name} | |
| Student(s) | Barataa (m), Barattuu (f) / Barattoota | |
| Parent | Maatii | as in SMS |
| Class(es) | Kutaa / Kutaalee | |
| Grade (column) | Sadarkaa; "Grade {grade}" -> "Kutaa {grade}" | |
| Section | Garee | low confidence |
| Academic year | Bara barnootaa | |
| Roll number | Lakkoofsa tartiibaa (short: Lakk.) | |
| Attendance | Argama | never "hirmaannaa" |
| Take/mark attendance | Argama galmeessi | |
| Mark (verb) | Mallatteessi; marked = mallatteeffame | |
| Present / Absent / Late / Excused | Argame / Hafe / Booda dhufe / Hayyamaan | status labels |
| Absence (noun) | Hafuu | |
| Attendance history | Seenaa argamaa | |
| Record(s) | Galmee / Galmeewwan | |
| Request(s) | Gaaffii / Gaaffiiwwan | |
| Approve / Approved | Raggaasisi / Raggaasifame | |
| Reject / Rejected | Didi / Didame | |
| Pending | Eeggachaa jira | |
| Cancel (button) | Dhiisi | |
| Delete / Deleted | Haqi / Haqame; Deleted students = Barattoota haqaman | |
| Permanently delete | Guutummaatti haqi | |
| Withdraw request / Cancelled | Gaaffii haqi / Haqame | see review |
| Restore | Deebisi | |
| Move/transfer | Dabarsi (dabarsuu, dabarfamuu) | |
| Reason | Sababa | |
| Note (to teacher) | Yaada | |
| Save / Saved | Olkaa'i / Olkaa'ameera | |
| Edit | Gulaali | |
| Add | Dabali | |
| Confirm | Mirkaneessi | |
| Clear | Qulqulleessi | |
| Remove | Keessaa baasi | |
| Export | Baasi | |
| Search / Filter | Barbaadi / Calali | |
| Dashboard | Fuula jalqabaa | |
| Settings | Qindaa'ina | |
| Profile | Piroofaayilii | |
| Sign out | Ba'i | |
| Menu | Baafata | |
| Notifications | Beeksisota | |
| Active / Inactive / Suspended | Hojii irra / Hojii irra hin jiru / Dhorkame | |
| Gender / Male / Female | Saala / Dhiira / Dhalaa | |
| Age | Umurii; "# years" = Waggaa # | |
| Photo | Suuraa | |
| Parent phone / Alternative phone | Bilbila maatii / Bilbila biraa | |
| Phone number (field) | Lakk. bilbilaa | |
| Password | Jecha icciitii | |
| Optional | dirqama miti | |
| Total | Ida'ama | |
| Rate | Harka | see review |
| Ethiopian calendar | Akka Lakkoofsa Habashaa; era suffix A.L.H. | |
| Months | Fulbaana, Onkoloolessa, Sadaasa, Muddee, Amajjii, Guraandhala, Bitootessa, Ebla, Caamsaa, Waxabajjii, Adoolessa, Hagayya, Qaammee | |

### Conventions used
- Buttons/menu items: singular imperative (Olkaa'i, Haqi, Haquuf gaafadhu). Instructions/messages: polite plural (filadhaa, barreessaa, ni dandeessu, keessan).
- Failure toasts: "X ... hin danda'amne". Success: -eera / -amaniiru.
- Where a student's name is the subject and gender is unknown, I made "Galmeen {name}" (the record, masculine) the subject. This avoids gendered verbs and the nominative -n on names (for example teacherClasses.toast.added). Where `{gender}` is available, the sentences use "Barataan {name} ... -eera" / "Barattuun {name} ... -teetti".

### Please double-check
1. **Withdraw / Cancelled request** (requests.teacher.cancelRequest "Gaaffii haqi", common.status.cancelled "Haqame", teacher.cancelled "Gaaffiin haqameera"): "haq-" is also used for delete. I rejected "Deebifame" because it can mean "answered", and "Kaasi" because "gaaffii kaasuu" means "to raise a question". A better word for withdraw is welcome.
2. **Section = "Garee"**: low confidence. Many schools may just say "sekshinii" or use the letter alone.
3. **Late = "Booda dhufe"**: alternatives are "Turee dhufe" and "Tureera". Status labels Argame/Hafe/Booda dhufe use masculine forms as generic labels. Are they OK for girls too?
4. **Excused = "Hayyamaan"** (with permission): this is a status label. Would "Hayyama qaba" read better?
5. **Dashboard = "Fuula jalqabaa"**: this really means "home page". "Daashboordii" is the alternative.
6. **Export = "Baasi"** and **Remove = "Keessaa baasi"**: the glossary had "Gara faayilaatti baasi", which is too long for a button. Check that "Baasi" alone is clear as Export.
7. **Clear = "Qulqulleessi"** ("clean"): I picked it to keep away from Haqi (delete). Is it natural for clearing filters/dates?
8. **Gender verb forms**: female branches use ce'teetti, deebi'teetti, haqamteetti, ni dabarfamti. Please confirm the spellings.
9. **2pl question forms**: raggaasistu?, diddu?, haqxu?, qulqulleessituu? (adminDashboard confirm title). Check that "haqxu" (haq- + tu) is the accepted spelling and that the question forms are consistent; qulqulleessituu has a long uu.
10. **reviewedBy**: "Kan raggaasise / Kan dide / Kan ilaale: {name}" uses masculine verbs for the admin, whose gender is unknown.
11. **Rate = "Harka"** (percentage) in adminReports summary/csv: "Sadarkaa argamaa" or "Dhibbeentaa" may be clearer.
12. **Month names**: the glossary listed "Elba", but the standard spelling is **Ebla**, which I used. These are the Oromo names for the Gregorian months, now mapped 1:1 onto the Ethiopian months (Meskerem=Fulbaana … Pagume=Qaammee), as the coordinator asked. Oromia media do use them this way for the Ethiopian calendar, but please confirm, especially "Qaammee" for Pagume.
13. **Date format** "{month} {day}, {year}" was kept (e.g. "Fulbaana 12, 2017"); some writers prefer "Fulbaana 12, 2017 A.L.H." or day-first. The era suffix "A.L.H." needs confirming against the alternative "ALI" (Akka Lakkoofsa Itoophiyaa).
14. **Placeholder suffixes**: "{to}-tti" and "{className}-tti" use a hyphen because class names can be like "5A". Check that this reads naturally.
15. **Pagination** "{total} keessaa {from}–{to}" and "Fuula {page}/{pages}": I made them terse on purpose.
16. **Count plurals**: "one" uses the word "tokko" instead of "#" (e.g. "Kutaa tokko"), because "Kutaa 1" would read as "Grade 1".
17. **teacherDashboard.requests.pending**: "Gaaffiiwwan #tu raggaasisa eeggachaa jiru": the -tu focus marker after a number is unusual. A simpler form would be "Gaaffii #: raggaasisa eeggachaa jira".
18. **Menu = "Baafata"**: this is the menu/list term used in some Oromo UIs. Check that it is understood.
19. **requests.dialog.detailsPlaceholder** uses "Bitootessa 12" as the example date, in place of "12 March".

### Batches 4–6 (exams, adminExams, teacherExams; notifications, landing, auth, profile, superadmin, adminSettings; adminStudents, adminTeachers, adminClasses, students; common.errors.api)

The full `node scripts/i18n-sync.mjs --check` now shows **0 om lines**.

### Additional terms
| English | Oromo |
|---|---|
| Exam / Mid / Final | Qormaata / Qormaata walakkaa / Qormaata xumuraa |
| Assignment (exam type) | Hojii manaa |
| Result / Overall result | Bu'aa / Bu'aa waliigalaa |
| Marks / Maximum marks | Qabxii / Qabxii guddaa |
| Average (short) | Giddugaleessa (Gidd.) |
| Rank | Sadarkaa (the grade column is now "Sadarkaa kutaa" to avoid a clash) |
| Percentage | Dhibbeentaa |
| Grand total | Ida'ama waliigalaa |
| Subject(s) | Gosa barnootaa / Gosoota barnootaa |
| Draft | Wixinee |
| Promoted / Not promoted | Darbe / Hin darbine |
| Certificate | Waraqaa ragaa |
| Islamic subjects | Siiraa, Aqiidaa, Hadiisa, Zikrii, Afaan Arabaa, Fiqhii; Tajweed = Tajwiida |
| Account | Herrega |
| Sign in / Signing in | Seeni / Seenaa jira… |
| Notifications (bell) / Announcements | Beeksisota / Beeksisa waliigalaa |
| Absence alerts / Attendance reminders | Beeksisa hafuu / Yaadachiisa argamaa |
| Install (app) | Diriirsi |
| Home screen | Iskiriinii jalqabaa |
| User(s) | Fayyadamaa / Fayyadamtoota |
| Deactivate / Activate | Hojii irraa dhaabi / Hojiirra oolchi |
| Suspend / Reactivate (school) | Dhorki / Deebisii hojiirra oolchi |
| Temporary password | Jecha icciitii yeroo |
| Import CSV / Bulk upload / Template | CSV galchi / Hedduu walfaana ol fe'i / Unka |
| Registration (student) | Galmee barattootaa |
| Download | Buusi |
| Time zone | Naannoo yeroo |
| Camera front/back | Kaameraa fuulaa / Kaameraa duubaa |

### Please double-check (batches 4–6)
20. **Assignment = "Hojii manaa"** (homework). If the mark is for classwork or continuous assessment, "Hojii ramadamaa" or "Madaallii itti fufiinsaa" may fit better.
21. **Islamic subject spellings** (Siiraa, Aqiidaa, Hadiisa, Zikrii, Fiqhii, Tajwiida): these are how Oromo Muslims usually write them, but they vary by region. A madarasaa teacher should confirm them, since they print on certificates.
22. **Promoted = "Darbe" / "Hin darbine"**: these print on certificates and the verb is masculine. The certificate code may not have the student's gender. If it does, "Darbite" is the female form.
23. **Notifications vs announcements**: the bell is "Beeksisota" and the announcements tab is "Beeksisa waliigalaa". Oromo has no clean pair for these two. Alternatives are "Odeessa" or "Labsii" (too formal).
24. **Install = "Diriirsi"**: an alternative is "Fe'i" (load), which is less precise. The iOS steps keep the English button names ("Share", "Add to Home Screen", "Add") in quotes because iOS has no Oromo UI.
25. **"Seenaa jira…"** (signing in) is spelled the same as "Seenaa" (history). Grammar and context make it clear, but if it confuses users, change it to "Seenuu irra jira…".
26. **CSV template headers** (adminStudents.csv): Maqaa, Lakkoofsa tartiibaa, Saala, Umurii, Kutaa, Maqaa kutaa, Garee, Bilbila maatii, Bilbila biraa, Afaan maatii. They have no commas and are in sentence case. Make sure the importer matches these (case-insensitive). Note that "Kutaa" and "Maqaa kutaa" are both headers, as in English.
27. **Toasts with a name subject and no gender** use "Herregni {name} …" (users), "Galmeen {name} …" (students), "Kutaan {name} …" and "Manni barumsaa {name} …" for the same reason as before.
28. **"SMS'f"** (for SMS): check the apostrophe-plus-suffix style. Other options are "SMSf" or "SMS dhaaf".
29. **adminLine "{teacher} … hin galmeessine"**: I did not add "Ustaaz", because the app also serves regular schools and female teachers (Ustaaza). The negative past is the same for both genders.
30. **Footer** "Mirgi hundi seeraan kan eegame dha." is a common rendering of "All rights reserved." Check that it sounds natural.
31. **Spelling fix**: in batch 3 adminDashboard I had written "Herreega"; it is now "Herrega".
32. **students.detail.studentId = "Eenyummaa barataa (ID)"**: "ID" is kept because users see the raw ID value.

### Terminology change: madrasa / ustaz (owner's decision)

101 strings changed across all om namespaces (100 term replacements plus emailPlaceholder -> "ustaz@madrasa.com"). The full check shows 0 om lines.

| Concept | Old | New (case forms used) |
|---|---|---|
| School | mana barumsaa | madarasaa; nominative **madarasaan**; plural **madarasaalee**; dative madarasaaf / madarasaatiif; "madarasaa biraatti", "madarasaa kamittuu" |
| School admin | Bulchaa mana barumsaa | **Bulchaa madarasaa** |
| Teacher | barsiisaa | **Ustaaz**; nominative **ustaazni**; dative **ustaaziif** |
| Teachers | Barsiisota | **Ustaazota**; nominative **ustaazonni**; genitive ustaazotaa; dative ustaazotaaf |

The verb "barsiisuu" (to teach) stays as it is, e.g. "Kutaalee ustaazni kun barsiisu".

### Please double-check
33. **Plural "Ustaazota" / "Ustaazonni"**: this follows the Oromo -ota plural (like barsiisota). Some communities say "Ustaazoota" (long oo) or use the Arabic-style "Asaatiza". Pick one and keep it everywhere.
34. **Nominative "ustaazni"**: consonant-final common nouns take -ni ("Ustaazni yaada keessan ni arga"). Some writers leave loanwords unmarked ("Ustaaz ... ni arga"). Genitive positions were left unmarked ("Herregni ustaaz", "Gaaffiin ustaaz").
35. **Plural "madarasaalee"**: the -lee plural was chosen. "Madrasota" is another option.
36. **Female ustaz**: the English uses only "Ustaz". If female teachers matter, "Ustaaza" could be added later through a select.
37. **Brand placeholders** "Fkn. Khendeq Medresah" were left as they are, since that is the brand and English still uses it.

### Rebrand: MMS, plus branding namespace

The new `branding` namespace is done. Also new: common.theme.*, auth.errors.otherMadrasa, auth.poweredBy, auth.madrasaNotFound.*. The {app} placeholder is now in notifications.install, and landing uses MMS. The check shows 0 om lines.

| English | Oromo |
|---|---|
| Madrasa Management System | Sirna Bulchiinsa Madarasaa (capitalised as a product name) |
| Branding | Mallattoo |
| Link / link name | Liinkii / Maqaa liinkii |
| App name / App icon | Maqaa appii / Mallattoo appii |
| Logo / default logo | Loogoo / Loogoo durtii |
| Staff | Hojjettoota |
| Appearance / Light / Dark / Device setting | Bifa / Ifaa / Dukkana / Akka qindaa'ina meeshaa |
| Powered by | Kan hojjetame: |

### Please double-check
38. **"Mallattoo"** is used for both "branding" and "icon" (Mallattoo appii). "Eenyummaa daldalaa" (brand identity) is more exact but long.
39. **Theme**: "Bifa" (appearance) and "Ifaa/Dukkana" (light/dark) need confirming. "Akka qindaa'ina meeshaa" means "as the device setting".
40. **"Powered by" = "Kan hojjetame: MMS — …"**: literally "made by". An alternative is "Kan MMS — … tiin hojjetame".
41. **slugHint**: "qubee xixiqqaa" means lowercase letters and "sararoota (-)" means dashes. Oromo users may not know "slug" rules, so the reviewer should check that this is clear.
42. **"Fkn. Khendeq Medresah"** is kept in the two namePlaceholders, because it is an example madrasa name and English still uses it.
43. **"Duubbee iftoomaa"** (transparent background) in logoHint: check that it is understandable. "Duubbee hin mul'anne" is an alternative.

---

## Somali (so) translation review

Namespaces done: all 26 (common, nav, requests, teacher*, admin*, dates, exams, notifications, landing, auth, profile, superadmin, students). The full `i18n-sync --check` shows 0 `so` lines.

### Term list (English -> Somali)

| English | Somali | Notes |
|---|---|---|
| School | Dugsi / dugsiga | not "iskuul" |
| Platform | Madal | |
| Student(s) | Arday / ardayga / ardayda | singular after numbers: "5 arday" |
| Teacher(s) | Macallin / macallinka / macallimiinta | |
| School admin | Maamulaha dugsiga (short: maamulaha / maamuluhu) | |
| Platform admin (superadmin) | Maamulaha madasha | glossary says "Maamulaha guud"; I picked "madasha" so it isn't mistaken for the school's head admin |
| Class | Fasal / fasalka / fasallada | |
| Section | Qaybta | |
| Attendance | Xaadiris(ka) | |
| Take attendance | Qaado xaadiriska | |
| Exam(s) | Imtixaan / imtixaannada | |
| Results | Natiijooyinka | |
| Reports | Warbixinnada | |
| History | Taariikhda | |
| Request(s) | Codsi / codsiyada | |
| My requests | Codsiyadayda | |
| Request (verb, button) | Codso … | "Codso tirtirka", "Codso wareejinta" |
| Send request | Dir codsiga | |
| Withdraw (request) | Dib u qaado; toast: "Codsiga dib ayaa loo qaatay." | I didn't use "Ka noqo" because it means undo / go back |
| Pending | La sugayo | |
| Waiting for you (tab) | Sugaya go'aankaaga | |
| Approve / Approved | Ansixi / La ansixiyay | |
| Reject / Rejected | Diid / La diiday | |
| Cancel (button) | Jooji | |
| Cancelled (status) | La joojiyay | |
| Suspended | La hakiyay | the glossary had "La joojiyay"; I changed it to keep it separate from Cancelled |
| Inactive | Aan firfircoonayn | the glossary had "La hakiyay"; I changed it, as above |
| Active | Firfircoon | |
| Delete | Tirtir | |
| Deleted students | Ardayda la tirtiray | used as the page name inside sentences, capitalised |
| Permanently delete | Si joogto ah u tirtir | |
| Restore | Soo celi | |
| Move / transfer to class | U wareeji (fasal kale); noun: wareejin | |
| Reason | Sababta | |
| Note (to teacher) | Qoraal | "Qoraalka maamulaha" = admin's note |
| Actions (menu/column) | Ficillo | "Ficillo kale" = more actions |
| Save / Saved | Kaydi / Waa la kaydiyay | |
| Edit | Wax ka beddel | |
| Export | Soo saar | the glossary also offered "U dhoofi", but that sounds like exporting goods |
| Upload | Soo geli | |
| Loading | Waa la soo rarayaa… | |
| Filter | Shaandhee | |
| Dashboard | Bogga guud | |
| Settings | Dejinta | |
| Profile | Borofaylka | |
| Sign out | Ka bax | |
| Notifications | Ogeysiisyada | never "digniin" |
| Menu (open/close) | Fur liiska / Xir liiska | |
| Male / Female | Lab / Dheddig | see below |
| Parent | Waalid | as in the SMS |
| Optional | (ikhtiyaari) | |

### Strings a native reviewer should check

1. `common.gender.male/female` = "Lab/Dheddig". These match official forms. If this label is shown mostly next to students, "Wiil/Gabar" may feel warmer. Whichever you pick, use it everywhere.
2. `common.actions.upload` = "Soo geli", and `status.loading` = "Waa la soo rarayaa…". Please confirm "Soo geli" reads as "upload" (the alternative is "Soo rar").
3. `common.actions.clear` = "Nadiifi" (used to clear filters or a search). "Masax" is an alternative.
4. `common.fields.notes` = "Qoraallo", and `fields.actions` = "Ficillo" (table header). Check they sound natural as column headers.
5. `common.pagination.page` = "Bogga {page} ee {pages}". The alternative is "Bogga {page} / {pages}".
6. `requests.admin.from/to`: I used "Fasalka hore" / "Fasalka cusub" (old class / new class) instead of a bare "Ka/U", which can't stand alone in Somali. This assumes the labels only appear on class-transfer rows.
7. `requests.admin.reviewedBy` = "{status} · {name} · {date}". The English "Approved by X" doesn't fit word for word when the status is interpolated, so I used separators. "Waxaa ansixiyay X" would read better, but the code would need a separate key for each status.
8. `requests.admin.approveTransferEffect` = "{name} waxaa {from} looga wareejin doonaa {to}." Please check this reads well with real class names (e.g. "Fasalka 3aad").
9. `requests.reasons.*` are short labels in the past tense with no subject. "Joojiyay imaanshaha dugsiga" (stopped attending) and "Qoysku meel kale ayuu u guuray" (family moved away) need checking for tone.
10. `requests.dialog.detailsPlaceholder` uses the Gregorian "12 Maarso". If the UI shows Ethiopian dates, this example could use an Ethiopian month instead.
11. `requests.tabPending` = "Sugaya go'aankaaga" (awaiting your decision). This is a little longer than the English "Waiting for you".
12. `common.errors.permission` = "Uma lihid ogolaansho aad tan ku samayso." Please confirm the phrasing.
13. I avoided gendered pronouns for students where I could ("natiijooyinka ardayga" rather than "natiijooyinkiisa"), because {name} can be either gender. "ardaygu … ayuu" uses the generic masculine, which is normal Somali.

### Update to batch 1 (requests)
- `admin.reviewedBy` now uses select: "Waxaa ansixiyay / Waxaa diiday / Waxaa dib u eegay {name} · {date}". This replaces note 7 above.
- The gender selects (`dialog.deleted`, `approveDeleteEffect`, `approveTransferEffect`, `deleted.restored`, `deleted.purged`) add "Ardayda {name}" (female) or "Ardayga {name}" (male) at the start of the sentence. The verbs are impersonal passives (la/loo …), which are the same for both genders. `approveDeleteEffect` also changes the possessive: -keeda (female) / -kiisa (male). Please check that adding "Ardayda/Ardayga" before a name sounds natural rather than heavy.

### Terms added in later batches
| English | Somali |
|---|---|
| Absence (count noun) | Maqnaansho |
| Present / Absent / Late / Excused | Jooga / Maqan / Daahay / Fasax |
| Mark (verb, attendance) | Calaamadee |
| Roll number / short "Roll" | Lambarka taxanaha / Lambar |
| Grade (level) | Heerka (to keep it apart from Fasal = class) |
| Assign / assigned | Qoondee / loo qoondeeyay |
| Record(s) | Diiwaan / diiwaannada |
| Register / registration | Diiwaangeli / diiwaangelinta |
| Mark(s) (exam) | Buundo / buundooyinka |
| Maximum marks | Buundada ugu badan |
| Average / Rank / Total / Grand total | Celcelis / Kaalinta / Wadarta / Wadarta guud |
| Percentage | Boqolley |
| Subject | Maaddo |
| Draft | Qabyo |
| Certificate | Shahaado |
| Promoted / Not promoted | U gudbay / Ma gudbin |
| Download | Soo deji |
| Import (CSV) | Soo geli |
| Template | Qaab |
| Row / Column | Saf / Tiir |
| Account | Akoon |
| Sign in | Gal (noun: galitaanka) |
| Password | Furaha sirta (ah) |
| Temporary password | Furaha sirta ku meel gaarka ah |
| Activate / Deactivate (user) | Hawlgeli akoonka / Jooji akoonka |
| Suspend / Reactivate (school) | Hakii / Dib u hawlgeli |
| Announcement(s) | Wargelin / Wargelinta |
| Absence alert | Digniinta maqnaanshaha |
| Reminder | Xusuusin |
| Publish | Daabac |
| Ustaz (title) | Ustaad |
| Ethiopian calendar | Kalandarka Itoobiya |
| Install (app) | Ku rakib |

### Strings to check (batches 2–6)
14. **Grade vs class.** In `teacherClasses.classCard.grade` ("Heerka {grade}"), `adminClasses.form.grade` and `adminDashboard.classes.table.grade` I used "Heerka", because "Fasalka {grade}" would clash with the class name. On the certificate, `exams.certificate.nextGrade` = "Fasalka xiga", which reads more naturally there. Check whether the reviewer accepts this split.
15. **Male/Female on the dashboard.** "Ardayda lab / dheddig" (`adminDashboard.kpi.*`, `charts.byClassDescription`) follows common.gender. "Wiilasha / Gabdhaha" would be far more natural on a dugsi dashboard. If the reviewer agrees, switch all gender strings together: common.gender, adminDashboard kpi, titleMale/titleFemale, charts.male/female.
16. **Announcements vs notifications.** nav.notifications = "Ogeysiisyada" is the umbrella, so announcements became "Wargelinta" to avoid having the same label for the parent page and its tab. Absence alerts use "Digniinta maqnaanshaha": these really are cautions, but the glossary warns against using "digniin" loosely. The alternative is "Feejignaanta maqnaanshaha".
17. **`dates.format.withEra`** = "{date} T.I." (Taariikhda Itoobiya). I don't know of an established abbreviation, so the reviewer might prefer "{date} (Itoobiya)" or keeping "E.C.". `dates.months` are the plain Ethiopian transliterations (Meskerem … Pagume) because I'm not confident of an established Somali set. "Pagume" keeps the p, which Somali orthography doesn't have; "Bagume" is a possible adaptation. Long and short dates use day-first order: "{day} {month} {year}".
18. **Islamic subject names on the certificate:** Siiro, Caqiido, Xadiis, Dikri, Af-Carabi, Fiqi. Check the spellings and whether madrasa staff prefer the Arabic-style forms (e.g. "Siirah", "Fiqh").
19. **Assignment as an exam type** = "Hawl-guri" (homework). If it means classwork or a graded task, "Hawl" or "Shaqo-fasal" might fit better.
20. **`exams.table.outOf`** = "ka mid ah {max}". Check it next to a score (e.g. "85 ka mid ah 100"); "/ {max}" might be cleaner.
21. **`notifications.reminders.adminLine`:** I added "Macallin {teacher} …". If {teacher} already contains a title, it will be doubled.
22. **iOS install steps:** I left “Add to Home Screen”, “Add” and “Share” in English because the iOS menus are in English (iOS has no Somali UI).
23. **`auth.errors.accountInactive`** = "…waa la joojiyay" and `userDisabled` = "…waa la xiray". Two different verbs for disabled and deactivated; check that both read calmly.
24. **CSV headers** (`adminStudents.csv.*`): Magaca, Lambarka taxanaha, Jinsiga, Da'da, Fasalka, Magaca fasalka, Qaybta, Taleefanka waalidka, Taleefan kale, Luqadda waalidka. "Da'da" has an apostrophe; check that the importer's header matching handles it. `importDialog.columns` lists the same names.
25. **`teacherExams.mark.invalidToast`:** "{count, plural, one {# buundo ayaa} other {# buundo ayaa}} ka baxsan xadka …". Check the word order once the count is filled in.
26. **"Wax ka beddel" vs "Cusboonaysii".** "Wax ka beddel" is the Edit button; "Cusboonaysii" (update/refresh) is used in descriptions and toasts. `actions.refresh` also uses "Cusboonaysii", which may be ambiguous next to "Update".

### Terminology change: madrasa / ustaz (owner's decision)
106 strings changed across 19 `so/*.json` files. The Somali SMS template in `src/lib/smsMessage.ts` now ends "…maanta madrasada iman."

- **School → madrasad** (definite: madrasada; plural: madrasado / madrasadaha). In Somali, "dugsi" most strongly means the traditional Qur'anic school (dugsi Qur'aan) and also ordinary schools. "Madrasad" is the standard, official word for an Islamic madrasa (Arabic loan in established Somali spelling), and it matches the owner's English. School admin → "Maamulaha madrasada".
  - *Grammar:* madrasad is feminine, so verbs and adjectives agree in the feminine. These sentences were rewritten: auth.subtitle "ay madrasadaadu ku siisay"; superadmin.create.description "Madrasadu waxay ku bilaabmaysaa iyadoo madhan… maamuleheeda"; superadmin.create.created "maamuleheeda"; landing "Madrasad kastaa waxay leedahay…" and "…oo madrasad u baahan tahay"; superadmin.empty "Weli madrasad ma jirto" and "madrasada ugu horreysa".
  - *Please check:* any sentence where madrasad is the grammatical subject still sounds natural.
- **Teacher → Ustaad** (definite: ustaadka; subject: ustaadku; plural: ustaadyo / ustaadyada / ustaadyadu). "Macallin" is also traditional for a Qur'an teacher. "Ustaad" is the usual title in madrasas, matches the owner's "Ustaz", and was already used for the teacher-name label.
  - *Please check:* whether reviewers prefer the Arabic broken plural "asaatiidda" over "ustaadyada". I chose "ustaadyada" because more readers will understand it.
- **Academic year:** "Sannad-dugsiyeedka" (literally "school year") became "Sannadka waxbarashada" so the word dugsi doesn't remain. "No academic year" is now "Sannad waxbarasho ma leh".
- **Email placeholder:** `adminTeachers.form.emailPlaceholder` now matches the English: ustaz@madrasa.com.
- **Reminder line:** `notifications.reminders.adminLine` is now "Ustaad {teacher} …". The same caveat as note 21 applies.
- **Review notes 1–26:** these still say dugsi/macallin, so read them with the new terms.

### MMS rebrand and the branding namespace
- **appTagline / product name:** "Nidaamka Maamulka Madrasadaha" (Madrasa Management System). I used it in common.appTagline, auth.poweredBy and landing.footer.copyright. "MMS" stays in Latin letters.
- **auth.poweredBy** = "Waxaa bixiya MMS — …" (literally "provided by"). Somali has no fixed equivalent of "Powered by". Please check this phrasing.
- **New terms:**

| English | Somali |
|---|---|
| Link | Xiriiriye / xiriiriyaha (already used for the password-reset link) |
| Link name (slug) | Magaca xiriiriyaha |
| Branding | Summadda |
| Logo | Calaamadda |
| App icon | Astaanta app-ka |
| Staff | Shaqaalaha |
| Appearance / Light / Dark / Device setting | Muuqaalka / Iftiin / Mugdi / Dejinta qalabka |

- **"Summadda" for branding:** "Summad" means a brand or trademark. Please check that it doesn't read too commercial; "Astaanta" is the alternative.
- **{app} gender:** `notifications.install.iosStep3` uses "{app} ayaa ka soo muuqan doona", which is gender-neutral because a madrasa's app name can be anything.
- **Name placeholders:** `adminSettings` / `superadmin` namePlaceholder still say "Khendeq Medresah", because the English source still does.
