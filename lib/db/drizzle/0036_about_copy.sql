DO $migration$
DECLARE
  settings_homepage jsonb;
  settings_about jsonb;
BEGIN
  SELECT "homepage", "about"
  INTO settings_homepage, settings_about
  FROM "ih_site_settings"
  WHERE "id" = 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF settings_homepage->>'aboutBody' = $old$Irwin Hunter & Co has been Western Australian owned and operated since 1966. We supply true to type seed from credible growers, blended into mixes that suit the paddock they are going into. Our long history across the state means we know which varieties perform in every region.$old$ THEN
    settings_homepage := jsonb_set(
      settings_homepage,
      '{aboutBody}',
      to_jsonb($new$IH Seeds (Irwin Hunter & Co) has been Western Australian, family owned and operated since 1966. We supply true to type pasture seed from accredited growers, plus specialist mixes built for WA conditions. Our seed is available through rural stores across the state and backed by sound technical advice from our team.$new$::text)
    );
  END IF;

  IF settings_about->>'heroEyebrow' = 'About Us' THEN
    settings_about := jsonb_set(settings_about, '{heroEyebrow}', to_jsonb('About IH Seeds'::text));
  END IF;

  IF settings_about->>'heroHeading' = 'Western Australian owned,' THEN
    settings_about := jsonb_set(settings_about, '{heroHeading}', to_jsonb('Proudly Western Australian,'::text));
  END IF;

  IF settings_about->>'heroIntro' = $old$Three generations of the Hunter family, one paddock question at a time: what will actually grow here.$old$ THEN
    settings_about := jsonb_set(
      settings_about,
      '{heroIntro}',
      to_jsonb($new$Family owned and operated for 60 years, supplying proven pasture seed and specialist mixes to farms from Derby to Esperance.$new$::text)
    );
  END IF;

  IF settings_about->>'storyLead' = $old$It started with a question every farmer in the south-west was asking: which seed will actually perform on my ground, in my rainfall, under my grazing plan.$old$ THEN
    settings_about := jsonb_set(
      settings_about,
      '{storyLead}',
      to_jsonb($new$Every paddock in Western Australia is different. For 60 years, our job has been knowing which pasture seed will perform in yours.$new$::text)
    );
  END IF;

  IF settings_about->'storyParagraphs' = jsonb_build_array(
    $old$Irwin Hunter & Co was founded in 1966 by growers who were tired of buying seed blended for somewhere else. They started sourcing, testing and blending pasture seed for Western Australian conditions specifically — not the eastern states, not overseas trial data, but paddocks from Esperance to Derby.$old$,
    $old$Sixty years on, the company is still independently owned and run by the same family. We have watched varieties come and go, rainfall patterns shift, and three generations of resellers build their businesses alongside ours. What has not changed is the question we start with: what will actually grow here.$old$,
    $old$Today we supply through rural resellers across the state — from the wheatbelt to the Kimberley — with true to type seed across {productCount} from credible growers, and the technical advice to back it. We are an Australian Seed Federation member, and every mix we blend still gets tested against the same standard the founders set: would we sow it on our own place.$old$
  ) THEN
    settings_about := jsonb_set(
      settings_about,
      '{storyParagraphs}',
      jsonb_build_array(
        $new$IH Seeds (Irwin Hunter & Co) was established in 1966 and has been Western Australian, family owned and operated ever since. In 2026 we celebrate 60 years of supplying high-quality pasture seed across the state's agricultural and rangelands areas, from Derby in the north to Esperance in the south.$new$,
        $new$Western Australia's conditions are unlike anywhere else. Rainfall swings between the coast and inland, the sowing window after the autumn break is tight, and soils run from acidic sands to heavy clays. We work with domestic and international seed companies to source temperate and sub-tropical species suited to those conditions, and partner with specialist seed growers under accredited domestic and international certification programs. That protects the varietal and genetic integrity of every line we sell, so the seed you sow is true to type, consistent in quality and reliable in performance.$new$,
        $new$We range {productCount}, including our own specialist pasture and cover crop mixes, the Equi1st range for horse properties and Mix & Match custom mixes. Our customers include beef, sheep and dairy producers, hay growers, horse owners and small landholders, and many of them come to us after seeing how a pasture has performed on a neighbour's farm.$new$,
        $new$You can buy our seed through an extensive network of rural retail stores throughout Western Australia, and our team is always available for technical advice. Tell us your location, rainfall, soil type and pH, and we will help you choose the variety or mix that suits your paddock. As a member of the Australian Seed Federation, we follow its Code of Practice.$new$
      )
    );
  END IF;

  IF settings_about#>>'{values,0,body}' = $old$Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone.$old$ THEN
    settings_about := jsonb_set(
      settings_about,
      '{values,0,body}',
      to_jsonb($new$Local conditions, understood and applied. Our experience across Western Australia tells us which varieties and mixes deliver in your rainfall, your soil and your enterprise.$new$::text)
    );
  END IF;

  IF settings_about#>>'{values,1,body}' = $old$Varieties and mixes proven over generations across Australia, with trial data behind them.$old$ THEN
    settings_about := jsonb_set(
      settings_about,
      '{values,1,body}',
      to_jsonb($new$Pasture varieties and mixes proven over generations and across Australia. Seed from accredited growers, true to type and consistent with its description.$new$::text)
    );
  END IF;

  IF settings_about#>>'{values,2,body}' = $old$Confidence before the order. Support after it — through your local rural reseller.$old$ THEN
    settings_about := jsonb_set(
      settings_about,
      '{values,2,body}',
      to_jsonb($new$Confidence before the order, support after it. We combine local experience with knowledge shared by farmers to give sound technical advice, through your local store or direct from our team.$new$::text)
    );
  END IF;

  UPDATE "ih_site_settings"
  SET "homepage" = settings_homepage, "about" = settings_about
  WHERE "id" = 1;
END
$migration$;
