# API PROGRES — Documentation Complète

> **Source:** Ministère de l'Enseignement Supérieur et de la Recherche Scientifique (MESRS)  
> **Direction:** Direction des Réseaux et du Développement du Numérique (DRDN)  
> **Version:** Mars 2023  
> **Base URL:** `https://progres.mesrs.dz/api`

---

## Table des Matières

1. [Authentification](#1-authentification)
2. [Notes du Bac d'un Étudiant](#2-notes-du-bac-dun-étudiant)
3. [Dossier Bachelier Complet](#3-dossier-bachelier-complet)
4. [Groupes Pédagogiques](#4-groupes-pédagogiques)
5. [Inscriptions Administratives](#5-inscriptions-administratives)
6. [Congé Académique](#6-congé-académique)
7. [Informations Personnelles](#7-informations-personnelles)
8. [Bilan par Année Académique](#8-bilan-par-année-académique)
9. [Bilan par Semestre](#9-bilan-par-semestre)

---

## Conventions Générales

| Convention               | Détail                                                        |
| ------------------------ | ------------------------------------------------------------- |
| **Format**               | JSON                                                          |
| **Auth**                 | Token JWT via header `Authorization`                          |
| **Valeurs nulles**       | Non retournées (seules les valeurs non nulles sont renvoyées) |
| **Paramètres de chemin** | Notés `{param}` dans les URLs                                 |

---

## 1. Authentification

### `POST /api/authentication/v1/`

Obtenir un token JWT pour accéder à toutes les autres API.

**URL complète :**

```
https://progres.mesrs.dz/api/authentication/v1/
```

**Méthode :** `POST`

**Corps de la requête (Body — JSON) :**

```json
{
  "username": "votre_identifiant",
  "password": "votre_mot_de_passe"
}
```

**Réponse (200 OK) :**

```json
{
  "expirationDate": "2024-03-27T08:46:52.617+00:00",
  "token": "<JWT_TOKEN>",
  "userId": 6219438,
  "uuid": "c3E2b9c5-c171-4de1-a2b9-3b58668831a",
  "idIndividu": 36973752,
  "etablissementId": 136655,
  "userName": "201394695447"
}
```

**Utilisation du token dans les requêtes suivantes :**

Ajouter le token dans l'onglet **Headers** sous la clé `Authorization` :

```
Authorization: <votre_token_JWT>
```

---

## 2. Notes du Bac d'un Étudiant

### `GET /api/infos/bac/{uuid}/notes`

Récupère la liste des notes du baccalauréat d'un étudiant.

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/notes
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/notes
```

**Paramètres de chemin :**

| Paramètre | Type   | Description        |
| --------- | ------ | ------------------ |
| `uuid`    | String | UUID de l'étudiant |

**Ressource renvoyée — Tableau de :**

| Type     | Attribut                  | Description                    |
| -------- | ------------------------- | ------------------------------ |
| `String` | `matriculeBac`            | Matricule du bac               |
| `Double` | `Note`                    | Note obtenue                   |
| `String` | `refCodeMatiere`          | Code de la matière             |
| `String` | `refCodeMatiereLibelleFr` | Libellé français de la matière |
| `String` | `AnneeBac`                | Année du baccalauréat          |

---

## 3. Dossier Bachelier Complet

### `GET /api/infos/bac/{uuid}/`

Récupère toutes les informations sur le dossier bachelier d'un étudiant.

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/
```

**Paramètres de chemin :**

| Paramètre | Type   | Description        |
| --------- | ------ | ------------------ |
| `uuid`    | String | UUID de l'étudiant |

**Ressource renvoyée :**

| Type      | Attribut                          | Description                      |
| --------- | --------------------------------- | -------------------------------- |
| `Long`    | `Id`                              | Identifiant interne              |
| `String`  | `Nin`                             | Numéro d'identification national |
| `Double`  | `Matricule`                       | Matricule de l'étudiant          |
| `String`  | `nomAr`                           | Nom en arabe                     |
| `String`  | `prenomAr`                        | Prénom en arabe                  |
| `String`  | `nomFr`                           | Nom en français                  |
| `String`  | `prenomFr`                        | Prénom en français               |
| `Date`    | `dateNaissance`                   | Date de naissance                |
| `String`  | `moyenneBac`                      | Moyenne au baccalauréat          |
| `String`  | `prenomPere`                      | Prénom du père                   |
| `String`  | `nomPrenomMere`                   | Nom et prénom de la mère         |
| `String`  | `Telephone`                       | Numéro de téléphone              |
| `String`  | `adresseResidence`                | Adresse de résidence             |
| `String`  | `refCodeSexe`                     | Code sexe                        |
| `String`  | `refCodeWilayaNaissance`          | Code wilaya de naissance         |
| `String`  | `refCodeWilayaBac`                | Code wilaya du bac               |
| `String`  | `refCodeWilayaResidence`          | Code wilaya de résidence         |
| `String`  | `refCodeSerieBac`                 | Code série du bac                |
| `String`  | `libelleVilleNaissance`           | Libellé ville de naissance       |
| `String`  | `libelleSerieBac`                 | Libellé série du bac             |
| `int`     | `tag`                             | Tag                              |
| `int`     | `idImportation`                   | ID importation                   |
| `int`     | `idImportationAffectation`        | ID importation affectation       |
| `int`     | `idDossierEtudiant`               | ID dossier étudiant              |
| `String`  | `annee`                           | Année                            |
| `Boolean` | `estClassique`                    | Indique si classique             |
| `String`  | `refCodeEtablissement`            | Code établissement               |
| `String`  | `refCodeFiliere`                  | Code filière                     |
| `String`  | `numeroChoix`                     | Numéro de choix                  |
| `String`  | `noteAffectation`                 | Note d'affectation               |
| `String`  | `refCodeEtablissementRecours`     | Code établissement de recours    |
| `String`  | `refCodeFiliereRecours`           | Code filière de recours          |
| `String`  | `refCodeEtablissementOrientation` | Code établissement d'orientation |
| `String`  | `refCodeFiliereOrientation`       | Code filière d'orientation       |
| `String`  | `refCodeTypeAffectation`          | Code type d'affectation          |
| `String`  | `refCodeEtablissementAffectation` | Code établissement d'affectation |
| `String`  | `refCodeFiliereAffectation`       | Code filière d'affectation       |
| `String`  | `libelleFiliereAffectation`       | Libellé filière d'affectation    |
| `String`  | `codeFiliereInscription`          | Code filière d'inscription       |
| `String`  | `photoEtudiant`                   | Photo de l'étudiant              |
| `String`  | `photo`                           | Photo                            |
| `String`  | `anneeBac`                        | Année du bac                     |
| `Boolean` | `estMigree`                       | Dossier migré                    |
| `Boolean` | `affectationModifiee`             | Affectation modifiée             |
| `Boolean` | `soumiTest`                       | Soumis à un test                 |
| `Integer` | `idResultatTest`                  | ID résultat test                 |
| `String`  | `resultatTest`                    | Résultat du test                 |
| `Integer` | `statutAffectation`               | Statut d'affectation             |
| `List`    | `notesBacheliers`                 | Liste des notes du bac           |

---

## 4. Groupes Pédagogiques

### `GET /api/infos/dia/{idDia}/groups`

Récupère la liste des groupes pédagogiques auxquels appartient un étudiant pour une inscription administrative donnée (par année).

**URL complète :**

```
https://progres.mesrs.dz/api/infos/dia/{idDia}/groups
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/dia/6150897/groups
```

**Paramètres de chemin :**

| Paramètre | Type | Description                                |
| --------- | ---- | ------------------------------------------ |
| `idDia`   | Long | ID du dossier d'inscription administrative |

**Ressource renvoyée :**

| Type      | Attribut                | Description                     |
| --------- | ----------------------- | ------------------------------- |
| `Long`    | `Id`                    | Identifiant                     |
| `Long`    | `dossierInscriptionId`  | ID dossier inscription          |
| `Long`    | `dossierEtudiantId`     | ID dossier étudiant             |
| `Long`    | `individuId`            | ID individu                     |
| `String`  | `individuIdentifiant`   | Identifiant de l'individu       |
| `String`  | `nomEtudiant`           | Nom de l'étudiant               |
| `String`  | `prenomEtudiant`        | Prénom de l'étudiant            |
| `String`  | `nomEtudiantArabe`      | Nom en arabe                    |
| `String`  | `prenomEtudiantArabe`   | Prénom en arabe                 |
| `String`  | `numeroMatricule`       | Numéro de matricule             |
| `String`  | `numeroInscription`     | Numéro d'inscription            |
| `String`  | `etudiantCivilite`      | Civilité de l'étudiant          |
| `String`  | `urlPhoto`              | URL de la photo                 |
| `String`  | `etudiantSexe`          | Sexe de l'étudiant              |
| `Long`    | `groupePedagogiqueId`   | ID du groupe pédagogique        |
| `String`  | `codeGroupePedagogique` | Code du groupe pédagogique      |
| `String`  | `nomGroupePedagogique`  | Nom du groupe pédagogique       |
| `Long`    | `idSection`             | ID de la section                |
| `String`  | `codeSection`           | Code de la section              |
| `String`  | `nomSection`            | Nom de la section               |
| `Long`    | `refGroupeId`           | ID groupe de référence          |
| `Date`    | `dateAffectation`       | Date d'affectation              |
| `Date`    | `dateNaissanceEtudiant` | Date de naissance de l'étudiant |
| `Double`  | `moyenneBac`            | Moyenne au bac                  |
| `Double`  | `lastMoyenne`           | Dernière moyenne                |
| `Integer` | `periodeId`             | ID période                      |
| `String`  | `periodeCode`           | Code période                    |
| `String`  | `periodeLibelleLongLt`  | Libellé long de la période      |

---

## 5. Inscriptions Administratives

### `GET /api/infos/bac/{uuid}/dias`

Récupère la liste de toutes les inscriptions administratives d'un étudiant (toutes les années).

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/dias
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/dias
```

**Paramètres de chemin :**

| Paramètre | Type   | Description        |
| --------- | ------ | ------------------ |
| `uuid`    | String | UUID de l'étudiant |

**Ressource renvoyée — Tableau de :**

<details>
<summary>Voir tous les champs (liste étendue)</summary>

| Type      | Attribut                                  | Description                     |
| --------- | ----------------------------------------- | ------------------------------- |
| `Long`    | `id`                                      | Identifiant                     |
| `String`  | `numeroInscription`                       | Numéro d'inscription            |
| `Integer` | `anneeAcademiqueId`                       | ID année académique             |
| `String`  | `anneeAcademiqueCode`                     | Code année académique           |
| `String`  | `refLibelleTypeInscription`               | Type d'inscription              |
| `String`  | `refLibelleNatureInscription`             | Nature d'inscription            |
| `String`  | `refLibelleStatutEtudiant`                | Statut étudiant                 |
| `Integer` | `rang`                                    | Rang                            |
| `Boolean` | `estClassique`                            | Est classique                   |
| `Integer` | `situationId`                             | ID situation                    |
| `String`  | `situationLibelleFr`                      | Situation (français)            |
| `String`  | `situationLibelleAr`                      | Situation (arabe)               |
| `Long`    | `dossierId`                               | ID dossier                      |
| `Long`    | `dossierEtudiantId`                       | ID dossier étudiant             |
| `String`  | `numeroMatricule`                         | Numéro matricule                |
| `String`  | `resultRefCodeDomaine`                    | Code domaine                    |
| `String`  | `resultRefCodeFiliere`                    | Code filière                    |
| `String`  | `resultRefCodeSpecialite`                 | Code spécialité                 |
| `Integer` | `ouvertureOffreFormationId`               | ID ouverture offre formation    |
| `Integer` | `offreFormationId`                        | ID offre de formation           |
| `String`  | `offreFormationCode`                      | Code offre de formation         |
| `String`  | `offreFormationLibelleFr`                 | Libellé offre formation (FR)    |
| `String`  | `offreFormationLibelleAr`                 | Libellé offre formation (AR)    |
| `String`  | `refCodeCycle`                            | Code cycle                      |
| `String`  | `refCodeNiveau`                           | Code niveau                     |
| `String`  | `refLibelleCycle`                         | Libellé cycle                   |
| `String`  | `refLibelleCycleAr`                       | Libellé cycle (arabe)           |
| `String`  | `refLibelleNiveau`                        | Libellé niveau                  |
| `Date`    | `dateInscription`                         | Date d'inscription              |
| `String`  | `centreScolarite`                         | Centre de scolarité             |
| `String`  | `typeDossier`                             | Type de dossier                 |
| `String`  | `typeDossierLibelleFr`                    | Type dossier (FR)               |
| `String`  | `typeDossierLibelleAr`                    | Type dossier (AR)               |
| `Date`    | `dateCreation`                            | Date de création                |
| `Long`    | `exclusionId`                             | ID exclusion                    |
| `Long`    | `congeAcademiqueId`                       | ID congé académique             |
| `Boolean` | `estMigree`                               | Est migré                       |
| `Integer` | `idDomaine`                               | ID domaine                      |
| `String`  | `codeDomaine`                             | Code domaine                    |
| `String`  | `libelleCodeDomaine`                      | Libellé code domaine            |
| `String`  | `llDomaine`                               | Long libellé domaine            |
| `String`  | `llDomaineArabe`                          | Long libellé domaine (arabe)    |
| `Integer` | `idFiliere`                               | ID filière                      |
| `String`  | `codeFiliere`                             | Code filière                    |
| `String`  | `llFiliereArabe`                          | Libellé filière (arabe)         |
| `String`  | `llFiliere`                               | Libellé filière                 |
| `Integer` | `ofIdDomaine`                             | ID domaine offre formation      |
| `String`  | `ofCodeDomaine`                           | Code domaine offre formation    |
| `String`  | `ofLlDomaine`                             | Libellé domaine OF              |
| `String`  | `ofLlDomaineArabe`                        | Libellé domaine OF (arabe)      |
| `Integer` | `ofIdFiliere`                             | ID filière OF                   |
| `String`  | `ofCodeFiliere`                           | Code filière OF                 |
| `String`  | `ofLlFiliereArabe`                        | Libellé filière OF (arabe)      |
| `String`  | `ofLlFiliere`                             | Libellé filière OF              |
| `Integer` | `ofIdSpecialite`                          | ID spécialité OF                |
| `String`  | `ofCodeSpecialite`                        | Code spécialité OF              |
| `String`  | `ofLlSpecialiteArabe`                     | Libellé spécialité OF (arabe)   |
| `String`  | `ofLlSpecialite`                          | Libellé spécialité OF           |
| `String`  | `ofLibelleCodeSpecialite`                 | Libellé code spécialité OF      |
| `String`  | `photoEtudiant`                           | Photo étudiant                  |
| `Long`    | `individuId`                              | ID individu                     |
| `String`  | `nin`                                     | NIN                             |
| `String`  | `individuNomArabe`                        | Nom individu (arabe)            |
| `String`  | `individuNomLatin`                        | Nom individu (latin)            |
| `String`  | `individuPrenomArabe`                     | Prénom individu (arabe)         |
| `String`  | `individuPrenomLatin`                     | Prénom individu (latin)         |
| `Date`    | `individuDateNaissance`                   | Date naissance individu         |
| `String`  | `individuLieuNaissance`                   | Lieu naissance individu         |
| `String`  | `individuLieuNaissanceArabe`              | Lieu naissance individu (arabe) |
| `String`  | `individuNationaliteLibelleLongFr`        | Nationalité (FR)                |
| `String`  | `individuNationaliteLibelleLongAr`        | Nationalité (AR)                |
| `String`  | `individuSituationFamilialeLibelleLongFr` | Situation familiale (FR)        |
| `String`  | `IndividuServiceNationalLibelleLongFr`    | Service national (FR)           |
| `String`  | `individuGroupeSanguinLibelleLongFr`      | Groupe sanguin (FR)             |
| `String`  | `individuNomMereLatin`                    | Nom mère (latin)                |
| `String`  | `individuPrenomMereLatin`                 | Prénom mère (latin)             |
| `String`  | `individuPrenomPereLatin`                 | Prénom père (latin)             |
| `String`  | `individuNomMereArabe`                    | Nom mère (arabe)                |
| `String`  | `individuPrenomMereArabe`                 | Prénom mère (arabe)             |
| `String`  | `individuPrenomPereArabe`                 | Prénom père (arabe)             |
| `String`  | `individuCiviliteLibelleLongFr`           | Civilité (FR)                   |
| `String`  | `individuCiviliteLibelleLongAr`           | Civilité (AR)                   |
| `String`  | `individuWilayaNaissanceLibelleLongFr`    | Wilaya naissance (FR)           |
| `String`  | `individuWilayaNaissanceLibelleLongAr`    | Wilaya naissance (AR)           |
| `String`  | `individuWilayaNaissanceCode`             | Code wilaya naissance           |
| `Integer` | `individuWilayaNaissanceId`               | ID wilaya naissance             |
| `Integer` | `refEtablissementId`                      | ID établissement                |
| `String`  | `refCodeEtablissement`                    | Code établissement              |
| `String`  | `llEtablissementArabe`                    | Libellé établissement (arabe)   |
| `String`  | `llEtablissementLatin`                    | Libellé établissement (latin)   |
| `String`  | `adresseResidence`                        | Adresse de résidence            |
| `Long`    | `dossierBachelierId`                      | ID dossier bachelier            |
| `String`  | `matriculeBac`                            | Matricule bac                   |
| `double`  | `moyenneBac`                              | Moyenne bac                     |
| `String`  | `telephoneBachelier`                      | Téléphone bachelier             |
| `String`  | `anneeBac`                                | Année bac                       |
| `double`  | `lastMoyenne`                             | Dernière moyenne                |
| `String`  | `photo`                                   | Photo                           |
| `Integer` | `cycleId`                                 | ID cycle                        |
| `String`  | `cycleCode`                               | Code cycle                      |
| `String`  | `cycleLibelleLongLt`                      | Libellé cycle (latin)           |
| `String`  | `cycleLibelleLongAr`                      | Libellé cycle (arabe)           |
| `Integer` | `niveauId`                                | ID niveau                       |
| `String`  | `niveauCode`                              | Code niveau                     |
| `Integer` | `niveauRang`                              | Rang niveau                     |
| `String`  | `niveauLibelleLongLt`                     | Libellé niveau (latin)          |
| `String`  | `niveauLibelleLongAr`                     | Libellé niveau (arabe)          |
| `Boolean` | `herbergementDemande`                     | Hébergement demandé             |
| `Boolean` | `bourseDemandee`                          | Bourse demandée                 |
| `Integer` | `idTypeDemandeHebergement`                | ID type demande hébergement     |
| `String`  | `typeDemandeHebergementLibelleFr`         | Type demande hébergement (FR)   |
| `String`  | `typeDemandeHebergementLibelleAr`         | Type demande hébergement (AR)   |
| `Integer` | `idTypeDemandeBourse`                     | ID type demande bourse          |
| `String`  | `typeDemandeBourseLibelleFr`              | Type demande bourse (FR)        |
| `String`  | `typeDemandeBourseLibelleAr`              | Type demande bourse (AR)        |
| `Boolean` | `herbergementAccorde`                     | Hébergement accordé             |
| `Boolean` | `bourseAccordee`                          | Bourse accordée                 |
| `Integer` | `idTypeHebergement`                       | ID type hébergement             |
| `String`  | `typeHebergementLibelleFr`                | Type hébergement (FR)           |
| `String`  | `typeHebergementLibelleAr`                | Type hébergement (AR)           |
| `String`  | `lieuHebergement`                         | Lieu d'hébergement              |
| `Integer` | `ancienneteHebergement`                   | Ancienneté hébergement          |
| `Float`   | `montantBourse`                           | Montant de la bourse            |
| `Integer` | `ancienneteBourse`                        | Ancienneté bourse               |

</details>

---

## 6. Congé Académique

### `GET /api/infos/bac/{uuid}/anneeAcademique/{idAnneeAcademique}/congeacademique`

Récupère les informations sur le congé académique d'un étudiant pour une année académique donnée.

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/anneeAcademique/{idAnneeAcademique}/congeacademique
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/anneeAcademique/16/congeacademique
```

**Paramètres de chemin :**

| Paramètre           | Type    | Description              |
| ------------------- | ------- | ------------------------ |
| `uuid`              | String  | UUID de l'étudiant       |
| `idAnneeAcademique` | Integer | ID de l'année académique |

**Ressource renvoyée :**

| Type      | Attribut                                    | Description                    |
| --------- | ------------------------------------------- | ------------------------------ |
| `Long`    | `id`                                        | Identifiant                    |
| `Integer` | `ouvertureOffreFormationId`                 | ID ouverture offre formation   |
| `String`  | `libelleOffreFormationFr`                   | Libellé offre formation (FR)   |
| `String`  | `libelleOffreFormationAr`                   | Libellé offre formation (AR)   |
| `Integer` | `cycleId`                                   | ID cycle                       |
| `String`  | `cycleCode`                                 | Code cycle                     |
| `String`  | `cycleLibelleLongLt`                        | Libellé cycle (latin)          |
| `String`  | `cycleLibelleLongAr`                        | Libellé cycle (arabe)          |
| `Integer` | `niveauId`                                  | ID niveau                      |
| `String`  | `niveauCode`                                | Code niveau                    |
| `Integer` | `niveauRang`                                | Rang niveau                    |
| `String`  | `niveauLibelleLongLt`                       | Libellé niveau (latin)         |
| `String`  | `niveauLibelleLongAr`                       | Libellé niveau (arabe)         |
| `Long`    | `idDossierEtudiant`                         | ID dossier étudiant            |
| `Integer` | `idEtablissement`                           | ID établissement               |
| `Long`    | `dossierInscriptionId`                      | ID dossier inscription         |
| `String`  | `dossierEtudiantMatricule`                  | Matricule étudiant             |
| `Date`    | `dateDemande`                               | Date de la demande             |
| `Date`    | `dateDebutDemande`                          | Date début de la demande       |
| `Date`    | `dateFinDemande`                            | Date fin de la demande         |
| `Boolean` | `resultat`                                  | Résultat                       |
| `Date`    | `dateResultat`                              | Date du résultat               |
| `Date`    | `dateDebutAccordee`                         | Date début accordée            |
| `Date`    | `dateFinAccordee`                           | Date fin accordée              |
| `Boolean` | `decisionOnouValide`                        | Décision ONOU validée          |
| `String`  | `etudiantSexe`                              | Sexe de l'étudiant             |
| `String`  | `etudiantCivilite`                          | Civilité de l'étudiant         |
| `Date`    | `dateDecisionOnou`                          | Date décision ONOU             |
| `Integer` | `ncMotifRefusId`                            | ID motif de refus              |
| `String`  | `ncMotifRefusLibelleLongFr`                 | Motif de refus (FR)            |
| `Date`    | `dateReintegration`                         | Date de réintégration          |
| `Integer` | `ncTypeCongeId`                             | ID type congé                  |
| `String`  | `ncTypeCongeLibelleLongFr`                  | Type congé (FR)                |
| `Integer` | `situationId`                               | ID situation                   |
| `String`  | `libelleSituation`                          | Libellé situation              |
| `Boolean` | `demandeValidee`                            | Demande validée                |
| `Boolean` | `resultatValide`                            | Résultat validé                |
| `Boolean` | `reintegrationValidee`                      | Réintégration validée          |
| `Date`    | `dateValidationDemande`                     | Date validation demande        |
| `Date`    | `dateValidationResultat`                    | Date validation résultat       |
| `Date`    | `dateValidationReintegration`               | Date validation réintégration  |
| `Date`    | `dateDemandeReintegration`                  | Date demande réintégration     |
| `Date`    | `dateResultatReintegration`                 | Date résultat réintégration    |
| `Integer` | `individuId`                                | ID individu                    |
| `String`  | `individuNin`                               | NIN individu                   |
| `String`  | `EtudiantNomArabe`                          | Nom étudiant (arabe)           |
| `String`  | `EtudiantNomLatin`                          | Nom étudiant (latin)           |
| `String`  | `EtudiantPrenomArabe`                       | Prénom étudiant (arabe)        |
| `String`  | `EtudiantPrenomLatin`                       | Prénom étudiant (latin)        |
| `Date`    | `EtudiantDateNaissance`                     | Date de naissance              |
| `String`  | `EtudiantLieuNaissance`                     | Lieu de naissance              |
| `Integer` | `anneeAcademiqueId`                         | ID année académique            |
| `String`  | `anneeAcademiqueCode`                       | Code année académique          |
| `Short`   | `anneeAcademiquePremiereAnnee`              | Première année de l'académique |
| `Short`   | `anneeAcademiqueDeuxiemeAnnee`              | Deuxième année de l'académique |
| `Integer` | `anneeAcademiqueReintegrationId`            | ID année réintégration         |
| `String`  | `anneeAcademiqueReintegrationCode`          | Code année réintégration       |
| `Short`   | `anneeAcademiqueReintegrationPremiereAnnee` | 1ère année réintégration       |
| `Short`   | `anneeAcademiqueReintegrationDeuxiemeAnnee` | 2ème année réintégration       |
| `Integer` | `bacId`                                     | ID bac                         |
| `String`  | `bacMatricule`                              | Matricule bac                  |
| `String`  | `bacRefCodeSerie`                           | Code série bac                 |
| `String`  | `bacLibelleSerie`                           | Libellé série bac              |
| `String`  | `observation`                               | Observation                    |
| `Integer` | `ncMotifRefusReintegrationId`               | ID motif refus réintégration   |
| `String`  | `ncMotifRefusReintegrationLibelleLongFr`    | Motif refus réintégration (FR) |

---

## 7. Informations Personnelles

### `GET /api/infos/bac/{uuid}/individu`

Récupère les informations personnelles d'un individu étudiant.

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/individu
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/individu
```

**Paramètres de chemin :**

| Paramètre | Type   | Description        |
| --------- | ------ | ------------------ |
| `uuid`    | String | UUID de l'étudiant |

**Ressource renvoyée :**

| Type     | Attribut             | Description                |
| -------- | -------------------- | -------------------------- |
| `Long`   | `id`                 | Identifiant                |
| `String` | `identifiant`        | Identifiant                |
| `Date`   | `dateNaissance`      | Date de naissance          |
| `String` | `nomArabe`           | Nom en arabe               |
| `String` | `nomLatin`           | Nom en latin               |
| `String` | `prenomArabe`        | Prénom en arabe            |
| `String` | `prenomLatin`        | Prénom en latin            |
| `String` | `lieuNaissance`      | Lieu de naissance          |
| `String` | `lieuNaissanceArabe` | Lieu de naissance en arabe |
| `String` | `photo`              | URL photo                  |
| `String` | `email`              | Adresse email              |

---

## 8. Bilan par Année Académique

### `GET /api/infos/bac/{uuid}/dias/{idDia}/periode/bilans`

Récupère le bilan académique complet d'un étudiant pour une année académique (dossier d'inscription administrative).

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/dias/{idDia}/periode/bilans
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/dias/6845626/periode/bilans
```

**Paramètres de chemin :**

| Paramètre | Type   | Description                             |
| --------- | ------ | --------------------------------------- |
| `uuid`    | String | UUID de l'étudiant                      |
| `idDia`   | Long   | ID dossier d'inscription administrative |

**Ressource renvoyée :**

<details>
<summary>Voir tous les champs (liste étendue)</summary>

| Type                    | Attribut                             | Description                  |
| ----------------------- | ------------------------------------ | ---------------------------- |
| `Long`                  | `id`                                 | Identifiant                  |
| `int`                   | `type`                               | Type                         |
| `Integer`               | `oofId`                              | ID ouverture offre formation |
| `String`                | `offreFormationLibelleFr`            | Libellé offre formation (FR) |
| `String`                | `offreFormationLibelleAr`            | Libellé offre formation (AR) |
| `Long`                  | `deliberationSessionId`              | ID délibération session      |
| `Integer`               | `periodeId`                          | ID période                   |
| `String`                | `periodeLibelleFr`                   | Libellé période (FR)         |
| `String`                | `periodeLibelleAr`                   | Libellé période (AR)         |
| `List<BilanUeDto>`      | `bilanUes`                           | Bilan des UE                 |
| `List<BilanMcDto>`      | `bilanMcDtos`                        | Bilan des matières/MC        |
| `List<BilanSessionDto>` | `sessions`                           | Bilan des sessions           |
| `Date`                  | `dateDeliberation`                   | Date de délibération         |
| `BilanSessionDto`       | `bilanSessionDtoMax`                 | Meilleur bilan de session    |
| `Long`                  | `dossierInscriptionAdministrativeId` | ID DIA                       |
| `Long`                  | `individuId`                         | ID individu                  |
| `Integer`               | `situationId`                        | ID situation                 |
| `Long`                  | `planningSessionId`                  | ID planning session          |
| `String`                | `psIntitule`                         | Intitulé planning session    |
| `Date`                  | `psDateFin`                          | Date fin planning session    |
| `String`                | `psRefCodeTypeSession`               | Code type session            |
| `String`                | `nomArabeEtudiant`                   | Nom étudiant (arabe)         |
| `String`                | `nomLatinEtudiant`                   | Nom étudiant (latin)         |
| `String`                | `prenomArabeEtudiant`                | Prénom étudiant (arabe)      |
| `String`                | `prenomLatinEtudiant`                | Prénom étudiant (latin)      |
| `Date`                  | `dateNaissanceEtudiant`              | Date naissance étudiant      |
| `String`                | `lieuNaissanceEtudiant`              | Lieu naissance étudiant      |
| `Integer`               | `typeDecisionId`                     | ID type décision             |
| `String`                | `typeDecisionCode`                   | Code type décision           |
| `String`                | `typeDecisionLibelleFr`              | Libellé décision (FR)        |
| `String`                | `typeDecisionLibelleAr`              | Libellé décision (AR)        |
| `Integer`               | `mentionId`                          | ID mention                   |
| `String`                | `mentionCode`                        | Code mention                 |
| `String`                | `mentionLibelleFr`                   | Libellé mention (FR)         |
| `String`                | `mentionLibelleAr`                   | Libellé mention (AR)         |
| `String`                | `mentionLibelle`                     | Libellé mention              |
| `Integer`               | `anneeAcademiqueId`                  | ID année académique          |
| `String`                | `anneeAcademiqueCode`                | Code année académique        |
| `Integer`               | `refEtablissementId`                 | ID établissement             |
| `String`                | `refEtablissementCode`               | Code établissement           |
| `String`                | `refEtablissementLibelleFr`          | Libellé établissement (FR)   |
| `Double`                | `moyenne`                            | Moyenne                      |
| `Double`                | `moyenneSn`                          | Moyenne session normale      |
| `Double`                | `credit`                             | Crédit total                 |
| `Double`                | `creditObtenu`                       | Crédit obtenu                |
| `Double`                | `creditAcquis`                       | Crédit acquis                |
| `Double`                | `cumulCreditPrecedent`               | Cumul crédits précédents     |
| `Boolean`               | `annuel`                             | Bilan annuel                 |
| `Boolean`               | `bilanFinal`                         | Bilan final                  |
| `String`                | `matriculeEtudiant`                  | Matricule étudiant           |
| `String`                | `numeroInscriptionEtudiant`          | Numéro inscription étudiant  |
| `String`                | `sessionIntitule`                    | Intitulé session             |
| `Integer`               | `cycleId`                            | ID cycle                     |
| `String`                | `cycleCode`                          | Code cycle                   |
| `String`                | `cycleLibelleLongLt`                 | Libellé cycle (latin)        |
| `Integer`               | `niveauId`                           | ID niveau                    |
| `String`                | `niveauCode`                         | Code niveau                  |
| `int`                   | `niveauRang`                         | Rang niveau                  |
| `String`                | `niveauLibelleLongLt`                | Libellé niveau (latin)       |
| `String`                | `niveauLibelleLongAr`                | Libellé niveau (arabe)       |
| `Boolean`               | `creditMinObtenu`                    | Crédit minimum obtenu        |
| `Boolean`               | `oldSession`                         | Ancienne session             |
| `List<BilanSessionDto>` | `bilanSessionDtos`                   | Liste bilans session         |
| `Long`                  | `dossierEtudiantId`                  | ID dossier étudiant          |
| `Double`                | `moyenneGenerale`                    | Moyenne générale             |
| `String`                | `formattedMG`                        | Moyenne générale formatée    |
| `Boolean`               | `passageL1AvecDette`                 | Passage L1 avec dette        |
| `String`                | `styleClass`                         | Classe CSS (style UI)        |
| `Boolean`               | `admis`                              | Admis                        |
| `List<BilanSessionDto>` | `bilanAnnuels`                       | Bilans annuels               |
| `Long`                  | `bilanParentId`                      | ID bilan parent              |
| `String`                | `columnIntitule`                     | Intitulé colonne             |
| `String`                | `urlPhoto`                           | URL photo                    |
| `int`                   | `totalAquis`                         | Total acquis                 |
| `int`                   | `effectif`                           | Effectif                     |
| `Double`                | `tauxReussite`                       | Taux de réussite             |
| `Double`                | `sommeMoyenne`                       | Somme des moyennes           |
| `Double`                | `moyennePromo`                       | Moyenne de la promotion      |
| `Double`                | `moyenneControleContinu`             | Moyenne contrôle continu     |
| `Double`                | `noteControleIntermediaire`          | Note contrôle intermédiaire  |
| `Double`                | `noteExamen`                         | Note examen                  |
| `Double`                | `noteSession`                        | Note session                 |
| `String`                | `effectifTauxReussite`               | Effectif et taux de réussite |
| `Boolean`               | `addSession1`                        | Session 1 ajoutée            |
| `String`                | `intituleSession1`                   | Intitulé session 1           |
| `Double`                | `moyenneControleContinuSession1`     | Moyenne CC session 1         |
| `Double`                | `noteControleIntermediaireSession1`  | Note CI session 1            |
| `Double`                | `noteExamenSession1`                 | Note examen session 1        |
| `Double`                | `moyenneGeneraleSession1`            | Moyenne générale session 1   |
| `Boolean`               | `addSession2`                        | Session 2 ajoutée            |
| `String`                | `intituleSession2`                   | Intitulé session 2           |
| `Double`                | `moyenneControleContinuSession2`     | Moyenne CC session 2         |
| `Double`                | `noteControleIntermediaireSession2`  | Note CI session 2            |
| `Double`                | `noteExamenSession2`                 | Note examen session 2        |
| `Double`                | `moyenneGeneraleSession2`            | Moyenne générale session 2   |
| `Boolean`               | `avecControleContinu`                | Avec contrôle continu        |
| `Boolean`               | `avecControleIntermediaire`          | Avec contrôle intermédiaire  |
| `Double`                | `coefficientControleContinu`         | Coefficient CC               |
| `Double`                | `coefficientExamen`                  | Coefficient examen           |
| `Double`                | `coefficient`                        | Coefficient global           |
| `Double`                | `coefficientControleIntermediaire`   | Coefficient CI               |
| `Integer`               | `rattachementMcId`                   | ID rattachement MC           |
| `Boolean`               | `estMigree`                          | Est migré                    |
| `Date`                  | `dateGeneration`                     | Date de génération           |
| `Long`                  | `idDeliberationAnnuel`               | ID délibération annuelle     |
| `Date`                  | `dateDeliberationSn`                 | Date délibération SN         |
| `Date`                  | `dateDeliberationSRattrapage`        | Date délibération rattrapage |

</details>

---

## 9. Bilan par Semestre

### `GET /api/infos/bac/{uuid}/dia/{idDia}/periode/{idPeriode}/bilan`

Récupère le bilan d'un étudiant pour un semestre spécifique.

**URL complète :**

```
https://progres.mesrs.dz/api/infos/bac/{uuid}/dia/{idDia}/periode/{idPeriode}/bilan
```

**Exemple :**

```
https://progres.mesrs.dz/api/infos/bac/868b3632-21e4-443a-93aa-675aed543889/dia/6845626/periode/2482111/bilan
```

**Paramètres de chemin :**

| Paramètre   | Type   | Description                             |
| ----------- | ------ | --------------------------------------- |
| `uuid`      | String | UUID de l'étudiant                      |
| `idDia`     | Long   | ID dossier d'inscription administrative |
| `idPeriode` | Long   | ID de la période (semestre)             |

**Ressource renvoyée :**

| Type                               | Attribut                           | Description              |
| ---------------------------------- | ---------------------------------- | ------------------------ |
| `Long`                             | `id`                               | Identifiant              |
| `int`                              | `type`                             | Type                     |
| `Boolean`                          | `annuel`                           | Bilan annuel             |
| `OuvertureOffreFormation`          | `oof`                              | Objet offre de formation |
| `Periode`                          | `periode`                          | Objet période (semestre) |
| `List<BilanUe>`                    | `bilanUes`                         | Liste des bilans UE      |
| `DossierInscriptionAdministrative` | `dossierInscriptionAdministrative` | Dossier DIA              |
| `Nomenclature`                     | `typeDecision`                     | Type de décision         |
| `Double`                           | `moyenne`                          | Moyenne du semestre      |
| `Double`                           | `moyenneSn`                        | Moyenne session normale  |
| `Double`                           | `credit`                           | Crédit total             |
| `Double`                           | `creditObtenu`                     | Crédit obtenu            |
| `Double`                           | `creditAcquis`                     | Crédit acquis            |
| `Double`                           | `cumulCreditPrecedent`             | Cumul crédits précédents |
| `Double`                           | `coefficient`                      | Coefficient global       |

---

## Récapitulatif des Endpoints

| #    | Méthode | Endpoint                                                       | Description                  |
| ---- | ------- | -------------------------------------------------------------- | ---------------------------- |
| Auth | `POST`  | `/api/authentication/v1/`                                      | Obtenir un token JWT         |
| 1    | `GET`   | `/api/infos/bac/{uuid}/notes`                                  | Notes du bac                 |
| 2    | `GET`   | `/api/infos/bac/{uuid}/`                                       | Dossier bachelier complet    |
| 3    | `GET`   | `/api/infos/dia/{idDia}/groups`                                | Groupes pédagogiques         |
| 4    | `GET`   | `/api/infos/bac/{uuid}/dias`                                   | Inscriptions administratives |
| 5    | `GET`   | `/api/infos/bac/{uuid}/anneeAcademique/{idAA}/congeacademique` | Congé académique             |
| 6    | `GET`   | `/api/infos/bac/{uuid}/individu`                               | Informations personnelles    |
| 7    | `GET`   | `/api/infos/bac/{uuid}/dias/{idDia}/periode/bilans`            | Bilan annuel                 |
| 8    | `GET`   | `/api/infos/bac/{uuid}/dia/{idDia}/periode/{idPeriode}/bilan`  | Bilan par semestre           |

---

## Exemple de Flux d'Utilisation

```
1. POST /api/authentication/v1/
   → Récupérer le token JWT

2. GET /api/infos/bac/{uuid}/individu
   → Vérifier l'identité de l'étudiant

3. GET /api/infos/bac/{uuid}/dias
   → Obtenir la liste des inscriptions (récupérer idDia)

4. GET /api/infos/dia/{idDia}/groups
   → Voir les groupes pédagogiques de l'année

5. GET /api/infos/bac/{uuid}/dias/{idDia}/periode/bilans
   → Consulter le bilan annuel

6. GET /api/infos/bac/{uuid}/dia/{idDia}/periode/{idPeriode}/bilan
   → Consulter le bilan d'un semestre précis
```

---

_Documentation générée à partir des fichiers officiels DRDN — Mars 2023_
