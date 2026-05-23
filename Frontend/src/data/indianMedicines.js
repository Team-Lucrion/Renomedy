const baseIndianMedicines = [
  { brandName: 'Telma', genericName: 'Telmisartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg', '80 mg'] },
  { brandName: 'Telmikind', genericName: 'Telmisartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg', '80 mg'] },
  { brandName: 'Tazloc', genericName: 'Telmisartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg', '80 mg'] },
  { brandName: 'Sartel', genericName: 'Telmisartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Olmesar', genericName: 'Olmesartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Olmezest', genericName: 'Olmesartan', category: 'cardiovascular', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Losar', genericName: 'Losartan', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Losacar', genericName: 'Losartan', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Repace', genericName: 'Losartan', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Amlong', genericName: 'Amlodipine', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg', '10 mg'] },
  { brandName: 'Amlopres', genericName: 'Amlodipine', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg', '10 mg'] },
  { brandName: 'Stamlo', genericName: 'Amlodipine', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg', '10 mg'] },
  { brandName: 'Cilacar', genericName: 'Cilnidipine', category: 'cardiovascular', strengths: ['5 mg', '10 mg', '20 mg'] },
  { brandName: 'Cilaheart', genericName: 'Cilnidipine', category: 'cardiovascular', strengths: ['5 mg', '10 mg'] },
  { brandName: 'LNBloc', genericName: 'Cilnidipine', category: 'cardiovascular', strengths: ['10 mg', '20 mg'] },
  { brandName: 'Cardace', genericName: 'Ramipril', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg', '10 mg'] },
  { brandName: 'Ramistar', genericName: 'Ramipril', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Envas', genericName: 'Enalapril', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg', '10 mg'] },
  { brandName: 'Enam', genericName: 'Enalapril', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Nebicard', genericName: 'Nebivolol', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Nebistar', genericName: 'Nebivolol', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Betacap', genericName: 'Propranolol', category: 'cardiovascular', strengths: ['10 mg', '20 mg', '40 mg'] },
  { brandName: 'Metolar', genericName: 'Metoprolol', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Starpress', genericName: 'Metoprolol', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Arkamin', genericName: 'Clonidine', category: 'cardiovascular', strengths: ['100 mcg'] },
  { brandName: 'Minipress XL', genericName: 'Prazosin', category: 'cardiovascular', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Rosuvas', genericName: 'Rosuvastatin', category: 'cardiovascular', strengths: ['5 mg', '10 mg', '20 mg'] },
  { brandName: 'Rozavel', genericName: 'Rosuvastatin', category: 'cardiovascular', strengths: ['5 mg', '10 mg', '20 mg'] },
  { brandName: 'Atorva', genericName: 'Atorvastatin', category: 'cardiovascular', strengths: ['10 mg', '20 mg', '40 mg'] },
  { brandName: 'Tonact', genericName: 'Atorvastatin', category: 'cardiovascular', strengths: ['10 mg', '20 mg'] },
  { brandName: 'Storvas', genericName: 'Atorvastatin', category: 'cardiovascular', strengths: ['10 mg', '20 mg'] },
  { brandName: 'Ecosprin', genericName: 'Aspirin', category: 'cardiovascular', strengths: ['75 mg', '150 mg'] },
  { brandName: 'Clopitab', genericName: 'Clopidogrel', category: 'cardiovascular', strengths: ['75 mg'] },
  { brandName: 'Deplatt', genericName: 'Clopidogrel', category: 'cardiovascular', strengths: ['75 mg'] },
  { brandName: 'Febutaz', genericName: 'Febuxostat', category: 'cardiovascular', strengths: ['40 mg', '80 mg'] },
  { brandName: 'Glycomet', genericName: 'Metformin', category: 'diabetes', strengths: ['500 mg', '850 mg', '1000 mg'] },
  { brandName: 'Gluformin', genericName: 'Metformin', category: 'diabetes', strengths: ['500 mg', '1000 mg'] },
  { brandName: 'Cetapin', genericName: 'Metformin', category: 'diabetes', strengths: ['500 mg', '1000 mg'] },
  { brandName: 'Glycomet GP', genericName: 'Metformin + Glimepiride', category: 'diabetes', strengths: ['1/500 mg', '2/500 mg'] },
  { brandName: 'Gemer', genericName: 'Glimepiride + Metformin', category: 'diabetes', strengths: ['1/500 mg', '2/500 mg'] },
  { brandName: 'Amaryl', genericName: 'Glimepiride', category: 'diabetes', strengths: ['1 mg', '2 mg', '3 mg'] },
  { brandName: 'Zoryl', genericName: 'Glimepiride', category: 'diabetes', strengths: ['1 mg', '2 mg', '3 mg'] },
  { brandName: 'Diamicron', genericName: 'Gliclazide', category: 'diabetes', strengths: ['30 mg', '60 mg', '80 mg'] },
  { brandName: 'Reclide', genericName: 'Gliclazide', category: 'diabetes', strengths: ['40 mg', '80 mg'] },
  { brandName: 'Glizid', genericName: 'Gliclazide', category: 'diabetes', strengths: ['40 mg', '80 mg'] },
  { brandName: 'Tenepride', genericName: 'Teneligliptin', category: 'diabetes', strengths: ['20 mg'] },
  { brandName: 'Zita', genericName: 'Teneligliptin', category: 'diabetes', strengths: ['20 mg'] },
  { brandName: 'Trajenta', genericName: 'Linagliptin', category: 'diabetes', strengths: ['5 mg'] },
  { brandName: 'Januvia', genericName: 'Sitagliptin', category: 'diabetes', strengths: ['50 mg', '100 mg'] },
  { brandName: 'Janumet', genericName: 'Sitagliptin + Metformin', category: 'diabetes', strengths: ['50/500 mg', '50/1000 mg'] },
  { brandName: 'Istamet', genericName: 'Sitagliptin + Metformin', category: 'diabetes', strengths: ['50/500 mg', '50/1000 mg'] },
  { brandName: 'Galvus', genericName: 'Vildagliptin', category: 'diabetes', strengths: ['50 mg'] },
  { brandName: 'Galvus Met', genericName: 'Vildagliptin + Metformin', category: 'diabetes', strengths: ['50/500 mg', '50/1000 mg'] },
  { brandName: 'Jalra', genericName: 'Vildagliptin', category: 'diabetes', strengths: ['50 mg'] },
  { brandName: 'Jardiance', genericName: 'Empagliflozin', category: 'diabetes', strengths: ['10 mg', '25 mg'] },
  { brandName: 'Forxiga', genericName: 'Dapagliflozin', category: 'diabetes', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Oxra', genericName: 'Dapagliflozin', category: 'diabetes', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Remo', genericName: 'Remogliflozin', category: 'diabetes', strengths: ['100 mg'] },
  { brandName: 'Voglib', genericName: 'Voglibose', category: 'diabetes', strengths: ['0.2 mg', '0.3 mg'] },
  { brandName: 'Volibo', genericName: 'Voglibose', category: 'diabetes', strengths: ['0.2 mg', '0.3 mg'] },
  { brandName: 'Glucobay', genericName: 'Acarbose', category: 'diabetes', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Pioz', genericName: 'Pioglitazone', category: 'diabetes', strengths: ['7.5 mg', '15 mg', '30 mg'] },
  { brandName: 'Tribet', genericName: 'Glimepiride + Metformin + Pioglitazone', category: 'diabetes', strengths: ['1 mg', '2 mg'] },
  { brandName: 'Dibizide', genericName: 'Glipizide', category: 'diabetes', strengths: ['5 mg'] },
  { brandName: 'Metride', genericName: 'Glimepiride + Metformin', category: 'diabetes', strengths: ['1/500 mg', '2/500 mg'] },
  { brandName: 'Glynase', genericName: 'Glibenclamide', category: 'diabetes', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Glykind-M', genericName: 'Gliclazide + Metformin', category: 'diabetes', strengths: ['40/500 mg', '80/500 mg'] },
  { brandName: 'Thyronorm', genericName: 'Levothyroxine', category: 'thyroid', strengths: ['12.5 mcg', '25 mcg', '50 mcg', '75 mcg', '100 mcg'] },
  { brandName: 'Eltroxin', genericName: 'Levothyroxine', category: 'thyroid', strengths: ['25 mcg', '50 mcg', '100 mcg'] },
  { brandName: 'Thyrox', genericName: 'Levothyroxine', category: 'thyroid', strengths: ['25 mcg', '50 mcg', '100 mcg'] },
  { brandName: 'Thyroup', genericName: 'Levothyroxine', category: 'thyroid', strengths: ['25 mcg', '50 mcg'] },
  { brandName: 'Neo-Mercazole', genericName: 'Carbimazole', category: 'thyroid', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Methimez', genericName: 'Methimazole', category: 'thyroid', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Thyrofit', genericName: 'Levothyroxine', category: 'thyroid', strengths: ['25 mcg', '50 mcg'] },
  { brandName: 'Thyrowel', genericName: 'Thyroid supplement', category: 'thyroid', strengths: ['tablet'] },
  { brandName: 'Augmentin', genericName: 'Amoxicillin + Clavulanate', category: 'antibiotics', strengths: ['375 mg', '625 mg', '1 g'] },
  { brandName: 'Moxikind-CV', genericName: 'Amoxicillin + Clavulanate', category: 'antibiotics', strengths: ['375 mg', '625 mg'] },
  { brandName: 'Clavam', genericName: 'Amoxicillin + Clavulanate', category: 'antibiotics', strengths: ['375 mg', '625 mg'] },
  { brandName: 'Novamox', genericName: 'Amoxicillin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Almox', genericName: 'Amoxicillin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Azithral', genericName: 'Azithromycin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Azee', genericName: 'Azithromycin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Zithrox', genericName: 'Azithromycin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Zifi', genericName: 'Cefixime', category: 'antibiotics', strengths: ['100 mg', '200 mg'] },
  { brandName: 'Taxim-O', genericName: 'Cefixime', category: 'antibiotics', strengths: ['100 mg', '200 mg'] },
  { brandName: 'Cefakind', genericName: 'Cefuroxime', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Ceftum', genericName: 'Cefuroxime', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Cepodem', genericName: 'Cefpodoxime', category: 'antibiotics', strengths: ['100 mg', '200 mg'] },
  { brandName: 'Kefpod', genericName: 'Cefpodoxime', category: 'antibiotics', strengths: ['100 mg', '200 mg'] },
  { brandName: 'Sporidex', genericName: 'Cephalexin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Doxicip', genericName: 'Doxycycline', category: 'antibiotics', strengths: ['100 mg'] },
  { brandName: 'Doxy-1', genericName: 'Doxycycline', category: 'antibiotics', strengths: ['100 mg'] },
  { brandName: 'Ciplox', genericName: 'Ciprofloxacin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Cifran', genericName: 'Ciprofloxacin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Levoflox', genericName: 'Levofloxacin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Levoday', genericName: 'Levofloxacin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Oflox', genericName: 'Ofloxacin', category: 'antibiotics', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Oflomac', genericName: 'Ofloxacin', category: 'antibiotics', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Norflox-TZ', genericName: 'Norfloxacin + Tinidazole', category: 'antibiotics', strengths: ['tablet'] },
  { brandName: 'Flagyl', genericName: 'Metronidazole', category: 'antibiotics', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Metrogyl', genericName: 'Metronidazole', category: 'antibiotics', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Tiniba', genericName: 'Tinidazole', category: 'antibiotics', strengths: ['300 mg', '500 mg'] },
  { brandName: 'Rifagut', genericName: 'Rifaximin', category: 'antibiotics', strengths: ['200 mg', '400 mg', '550 mg'] },
  { brandName: 'Claribid', genericName: 'Clarithromycin', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Roxid', genericName: 'Roxithromycin', category: 'antibiotics', strengths: ['150 mg'] },
  { brandName: 'Linezolid', genericName: 'Linezolid', category: 'antibiotics', strengths: ['600 mg'] },
  { brandName: 'Linid', genericName: 'Linezolid', category: 'antibiotics', strengths: ['600 mg'] },
  { brandName: 'Dolo', genericName: 'Paracetamol', category: 'pain_fever', strengths: ['500 mg', '650 mg'] },
  { brandName: 'Calpol', genericName: 'Paracetamol', category: 'pain_fever', strengths: ['500 mg', '650 mg'] },
  { brandName: 'Crocin', genericName: 'Paracetamol', category: 'pain_fever', strengths: ['500 mg', '650 mg'] },
  { brandName: 'Pacimol', genericName: 'Paracetamol', category: 'pain_fever', strengths: ['500 mg', '650 mg'] },
  { brandName: 'Combiflam', genericName: 'Ibuprofen + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Flexon', genericName: 'Ibuprofen + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Brufen', genericName: 'Ibuprofen', category: 'pain_fever', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Ibugesic', genericName: 'Ibuprofen', category: 'pain_fever', strengths: ['200 mg', '400 mg'] },
  { brandName: 'Zerodol', genericName: 'Aceclofenac', category: 'pain_fever', strengths: ['100 mg'] },
  { brandName: 'Hifenac', genericName: 'Aceclofenac', category: 'pain_fever', strengths: ['100 mg'] },
  { brandName: 'Voveran', genericName: 'Diclofenac', category: 'pain_fever', strengths: ['50 mg', '100 mg'] },
  { brandName: 'Dicloran', genericName: 'Diclofenac', category: 'pain_fever', strengths: ['50 mg'] },
  { brandName: 'Etoshine', genericName: 'Etoricoxib', category: 'pain_fever', strengths: ['60 mg', '90 mg', '120 mg'] },
  { brandName: 'Nucoxia', genericName: 'Etoricoxib', category: 'pain_fever', strengths: ['60 mg', '90 mg'] },
  { brandName: 'Meftal', genericName: 'Mefenamic acid', category: 'pain_fever', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Naprosyn', genericName: 'Naproxen', category: 'pain_fever', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Nicip', genericName: 'Nimesulide', category: 'pain_fever', strengths: ['100 mg'] },
  { brandName: 'Sumo', genericName: 'Nimesulide + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Ultracet', genericName: 'Tramadol + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Tramazac', genericName: 'Tramadol', category: 'pain_fever', strengths: ['50 mg'] },
  { brandName: 'Mobizox', genericName: 'Diclofenac + Paracetamol + Chlorzoxazone', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Myospaz', genericName: 'Chlorzoxazone + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Pan', genericName: 'Pantoprazole', category: 'gastro', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Pantocid', genericName: 'Pantoprazole', category: 'gastro', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Sompraz', genericName: 'Esomeprazole', category: 'gastro', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Omez', genericName: 'Omeprazole', category: 'gastro', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Rantac', genericName: 'Ranitidine', category: 'gastro', strengths: ['150 mg', '300 mg'] },
  { brandName: 'Famocid', genericName: 'Famotidine', category: 'gastro', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Ganaton', genericName: 'Itopride', category: 'gastro', strengths: ['50 mg'] },
  { brandName: 'Domstal', genericName: 'Domperidone', category: 'gastro', strengths: ['10 mg'] },
  { brandName: 'Perinorm', genericName: 'Metoclopramide', category: 'gastro', strengths: ['10 mg'] },
  { brandName: 'Emeset', genericName: 'Ondansetron', category: 'gastro', strengths: ['4 mg', '8 mg'] },
  { brandName: 'Zofer', genericName: 'Ondansetron', category: 'gastro', strengths: ['4 mg', '8 mg'] },
  { brandName: 'Cyclopam', genericName: 'Dicyclomine + Paracetamol', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Drotin', genericName: 'Drotaverine', category: 'gastro', strengths: ['40 mg', '80 mg'] },
  { brandName: 'Lactihep', genericName: 'Lactulose', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Duphalac', genericName: 'Lactulose', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Cremaffin', genericName: 'Liquid paraffin + Milk of magnesia', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Digene', genericName: 'Antacid', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Gelusil', genericName: 'Antacid', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Vizylac', genericName: 'Probiotic', category: 'gastro', strengths: ['capsule'] },
  { brandName: 'Econorm', genericName: 'Saccharomyces boulardii', category: 'gastro', strengths: ['250 mg'] },
  { brandName: 'Normaxin', genericName: 'Chlordiazepoxide + Clidinium + Dicyclomine', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Eldoper', genericName: 'Loperamide', category: 'gastro', strengths: ['2 mg'] },
  { brandName: 'Lomofen', genericName: 'Diphenoxylate + Atropine', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Shelcal', genericName: 'Calcium + Vitamin D3', category: 'vitamins_supplements', strengths: ['500 mg', 'HD'] },
  { brandName: 'Gemcal', genericName: 'Calcium + Vitamin D3', category: 'vitamins_supplements', strengths: ['500 mg'] },
  { brandName: 'Calcimax', genericName: 'Calcium + Vitamin D3', category: 'vitamins_supplements', strengths: ['500 mg'] },
  { brandName: 'Calcirol', genericName: 'Vitamin D3', category: 'vitamins_supplements', strengths: ['60000 IU'] },
  { brandName: 'Uprise-D3', genericName: 'Vitamin D3', category: 'vitamins_supplements', strengths: ['60000 IU'] },
  { brandName: 'D-Rise', genericName: 'Vitamin D3', category: 'vitamins_supplements', strengths: ['60000 IU'] },
  { brandName: 'Neurobion Forte', genericName: 'Vitamin B complex', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Becosules', genericName: 'Vitamin B complex', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Zincovit', genericName: 'Multivitamin + Zinc', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'A to Z NS', genericName: 'Multivitamin', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Supradyn', genericName: 'Multivitamin', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Renerve Plus', genericName: 'Methylcobalamin + Pregabalin', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Nurokind', genericName: 'Methylcobalamin', category: 'vitamins_supplements', strengths: ['500 mcg', '1500 mcg'] },
  { brandName: 'Mecobal', genericName: 'Methylcobalamin', category: 'vitamins_supplements', strengths: ['500 mcg'] },
  { brandName: 'Folvite', genericName: 'Folic acid', category: 'vitamins_supplements', strengths: ['5 mg'] },
  { brandName: 'Orofer XT', genericName: 'Iron + Folic acid', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Autrin', genericName: 'Iron + Folic acid', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Dexorange', genericName: 'Iron + Vitamin B12 + Folic acid', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Livogen', genericName: 'Iron + Folic acid', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Cobadex CZS', genericName: 'Multivitamin + Zinc + Selenium', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Evion', genericName: 'Vitamin E', category: 'vitamins_supplements', strengths: ['400 mg', '600 mg'] },
  { brandName: 'Limcee', genericName: 'Vitamin C', category: 'vitamins_supplements', strengths: ['500 mg'] },
  { brandName: 'Celin', genericName: 'Vitamin C', category: 'vitamins_supplements', strengths: ['500 mg'] },
  { brandName: 'Health OK', genericName: 'Multivitamin', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Dytor', genericName: 'Torsemide', category: 'cardiovascular', strengths: ['5 mg', '10 mg', '20 mg'] },
  { brandName: 'Lasix', genericName: 'Furosemide', category: 'cardiovascular', strengths: ['20 mg', '40 mg'] },
  { brandName: 'Aldactone', genericName: 'Spironolactone', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Fruselac', genericName: 'Furosemide + Spironolactone', category: 'cardiovascular', strengths: ['tablet'] },
  { brandName: 'Ivabrad', genericName: 'Ivabradine', category: 'cardiovascular', strengths: ['5 mg', '7.5 mg'] },
  { brandName: 'Coralan', genericName: 'Ivabradine', category: 'cardiovascular', strengths: ['5 mg', '7.5 mg'] },
  { brandName: 'Nikoran', genericName: 'Nicorandil', category: 'cardiovascular', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Nitrong', genericName: 'Nitroglycerin', category: 'cardiovascular', strengths: ['2.6 mg', '6.4 mg'] },
  { brandName: 'Moxovas', genericName: 'Moxonidine', category: 'cardiovascular', strengths: ['0.2 mg', '0.3 mg'] },
  { brandName: 'Tenormin', genericName: 'Atenolol', category: 'cardiovascular', strengths: ['25 mg', '50 mg'] },
  { brandName: 'Glynase-MF', genericName: 'Glibenclamide + Metformin', category: 'diabetes', strengths: ['tablet'] },
  { brandName: 'Gluconorm-G', genericName: 'Glimepiride + Metformin', category: 'diabetes', strengths: ['1 mg', '2 mg'] },
  { brandName: 'Kombiglyze', genericName: 'Saxagliptin + Metformin', category: 'diabetes', strengths: ['5/500 mg', '5/1000 mg'] },
  { brandName: 'Onglyza', genericName: 'Saxagliptin', category: 'diabetes', strengths: ['2.5 mg', '5 mg'] },
  { brandName: 'Gibtulio', genericName: 'Empagliflozin', category: 'diabetes', strengths: ['10 mg', '25 mg'] },
  { brandName: 'Daparyl', genericName: 'Dapagliflozin', category: 'diabetes', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Thyrocab', genericName: 'Carbimazole', category: 'thyroid', strengths: ['5 mg', '10 mg'] },
  { brandName: 'Cefadur', genericName: 'Cefadroxil', category: 'antibiotics', strengths: ['250 mg', '500 mg'] },
  { brandName: 'Moxclav', genericName: 'Amoxicillin + Clavulanate', category: 'antibiotics', strengths: ['375 mg', '625 mg'] },
  { brandName: 'Mahacef', genericName: 'Cefixime', category: 'antibiotics', strengths: ['100 mg', '200 mg'] },
  { brandName: 'Suprax', genericName: 'Cefixime', category: 'antibiotics', strengths: ['200 mg'] },
  { brandName: 'T Bact', genericName: 'Mupirocin', category: 'antibiotics', strengths: ['tablet'] },
  { brandName: 'Aldigesic', genericName: 'Aceclofenac + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Signoflam', genericName: 'Aceclofenac + Paracetamol + Serratiopeptidase', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Zerodol-P', genericName: 'Aceclofenac + Paracetamol', category: 'pain_fever', strengths: ['tablet'] },
  { brandName: 'Voveran SR', genericName: 'Diclofenac sustained release', category: 'pain_fever', strengths: ['75 mg', '100 mg'] },
  { brandName: 'Acidity-Relief', genericName: 'Antacid', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Pan-D', genericName: 'Pantoprazole + Domperidone', category: 'gastro', strengths: ['40/30 mg'] },
  { brandName: 'Omez-D', genericName: 'Omeprazole + Domperidone', category: 'gastro', strengths: ['capsule'] },
  { brandName: 'Sompraz-D', genericName: 'Esomeprazole + Domperidone', category: 'gastro', strengths: ['capsule'] },
  { brandName: 'Aristozyme', genericName: 'Digestive enzyme', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Happydent', genericName: 'Antacid', category: 'gastro', strengths: ['tablet'] },
  { brandName: 'Maxirich', genericName: 'Multivitamin', category: 'vitamins_supplements', strengths: ['tablet'] },
  { brandName: 'Revital H', genericName: 'Multivitamin + Ginseng', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Fefol-Z', genericName: 'Iron + Folic acid + Zinc', category: 'vitamins_supplements', strengths: ['capsule'] },
  { brandName: 'Calshine', genericName: 'Calcium + Vitamin D3', category: 'vitamins_supplements', strengths: ['tablet'] },
];

const catalogAliasMap = {
  Pan: ['pan 40', 'pan40', 'pantop', 'pantop 40'],
  Dolo: ['dolo 650', 'dolo650', 'doloo', 'dolo six fifty'],
  Telma: ['telma 40', 'telma40', 'telmisartan brand'],
  Glycomet: ['glycomet 500', 'glycomet500', 'glycomate', 'glycomet sr'],
  Ecosprin: ['ecosprin 75', 'ecosprin75', 'ecospirin', 'eco aspirin'],
  Thyronorm: ['thyronorm 50', 'thyronorm50', 'thyronorm fifty', 'thyronom'],
  Cetcip: ['cetrizine', 'citrezene', 'cetrezene', 'cetrizene', 'cetirizine', 'cetzine'],
  Cetzine: ['cetrizine', 'citrezene', 'cetrezene', 'cetrizene', 'cetirizine', 'cetcip'],
};

const supplementalIndianMedicines = [
  { brandName: 'Cetcip', genericName: 'Cetirizine', category: 'allergy', strengths: ['10 mg'] },
  { brandName: 'Cetzine', genericName: 'Cetirizine', category: 'allergy', strengths: ['10 mg'] },
];

baseIndianMedicines.push(...supplementalIndianMedicines);

function deriveCatalogTrustMetadata(category, genericName, brandName) {
  const normalized = `${brandName || ''} ${genericName || ''}`.toLowerCase();
  const formulation = /\bdsr\b/.test(normalized)
    ? 'dsr'
    : /\bsr\b|sustained release/.test(normalized)
      ? 'sr'
      : /\ber\b|extended release/.test(normalized)
        ? 'er'
        : 'plain';
  const categoryDefaults = {
    cardiovascular: { riskTier: 'medium', refillCriticality: 'high', strictTiming: true, updateSensitivity: 'high' },
    diabetes: { riskTier: 'medium', refillCriticality: 'high', strictTiming: true, updateSensitivity: 'high' },
    thyroid: { riskTier: 'medium', refillCriticality: 'high', strictTiming: true, updateSensitivity: 'high' },
    antibiotics: { riskTier: 'low', refillCriticality: 'medium', strictTiming: true, updateSensitivity: 'medium' },
    pain_fever: { riskTier: 'low', refillCriticality: 'low', strictTiming: false, updateSensitivity: 'medium' },
    gastro: { riskTier: 'low', refillCriticality: 'medium', strictTiming: false, updateSensitivity: 'medium' },
    vitamins_supplements: { riskTier: 'low', refillCriticality: 'low', strictTiming: false, updateSensitivity: 'low' },
    allergy: { riskTier: 'low', refillCriticality: 'low', strictTiming: false, updateSensitivity: 'low' },
  };
  const defaults = categoryDefaults[category] || { riskTier: 'unknown', refillCriticality: 'medium', strictTiming: false, updateSensitivity: 'medium' };

  return {
    ...defaults,
    formulation,
    decimalSensitive: /2\.5|0\.2|0\.3|12\.5|7\.5/.test(normalized) || category === 'thyroid',
    caregiverCautionState: defaults.updateSensitivity === 'high' ? 'confirm_changes' : 'routine_review',
  };
}

function splitCatalogMolecules(genericName) {
  return String(genericName || '')
    .replace(/sustained release|extended release/gi, '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeStrengthToken(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/microgram|mcgs?/g, 'mcg');
}

function parseIndianMedicineEntry(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeSearchText(raw);
  const strengthMatch = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu))?(?:\s|$)/i);
  const parsedStrength = strengthMatch
    ? `${strengthMatch[1]} ${strengthMatch[2] || (/thyro|eltroxin|thyrox/.test(normalized) ? 'mcg' : 'mg')}`
    : '';
  const nameOnly = strengthMatch
    ? normalized.replace(strengthMatch[0], ' ').replace(/\s+/g, ' ').trim()
    : normalized;

  return {
    raw,
    normalized,
    nameOnly,
    parsedStrength,
    strengthToken: normalizeStrengthToken(parsedStrength),
  };
}

const commonIndianMedicines = baseIndianMedicines.map((medicine) => ({
  ...medicine,
  aliases: catalogAliasMap[medicine.brandName] || [],
  molecules: splitCatalogMolecules(medicine.genericName),
  trustMetadata: deriveCatalogTrustMetadata(medicine.category, medicine.genericName, medicine.brandName),
}));

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function searchIndianMedicines(query, limit = 8) {
  const parsedQuery = parseIndianMedicineEntry(query);
  const normalizedQuery = parsedQuery.nameOnly || parsedQuery.normalized;
  if (normalizedQuery.length < 2) return [];

  return commonIndianMedicines
    .map((medicine) => {
      const brand = normalizeSearchText(medicine.brandName);
      const generic = normalizeSearchText(medicine.genericName);
      const aliases = (medicine.aliases || []).map(normalizeSearchText);
      const haystack = `${brand} ${generic} ${aliases.join(' ')}`;
      const hasNameMatch =
        brand.startsWith(normalizedQuery) ||
        aliases.some((alias) => alias.startsWith(normalizedQuery) || alias.includes(parsedQuery.normalized)) ||
        haystack.includes(normalizedQuery);
      if (!hasNameMatch) return null;

      const selectedStrength =
        medicine.strengths.find((strength) => normalizeStrengthToken(strength) === parsedQuery.strengthToken) || '';
      const strengthScore = parsedQuery.parsedStrength && selectedStrength ? -1 : 0;
      const score =
        strengthScore +
        (brand.startsWith(normalizedQuery)
          ? 0
          : aliases.some((alias) => alias.startsWith(normalizedQuery) || alias.includes(parsedQuery.normalized))
            ? 0.5
            : generic.startsWith(normalizedQuery)
              ? 2
              : 3);

      return {
        medicine: {
          ...medicine,
          selectedStrength,
          parsedInput: parsedQuery,
        },
        score,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.score - right.score || left.medicine.brandName.localeCompare(right.medicine.brandName))
    .slice(0, limit)
    .map((result) => result.medicine);
}

module.exports = {
  commonIndianMedicines,
  parseIndianMedicineEntry,
  searchIndianMedicines,
};
