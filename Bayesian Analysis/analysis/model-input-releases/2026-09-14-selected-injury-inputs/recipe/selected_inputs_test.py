import unittest
from build_selected_inputs import numerical_route


class SamplingRouteTests(unittest.TestCase):
    def base(self, **extra):
        return dict(metric='incidence', injury_count='', exposure_player_hours='',
                    rate_per_1000_player_hours='2', ci95_lower='', ci95_upper='', **extra)

    def test_zero_count_is_usable(self):
        r=self.base();r.update(injury_count='0', exposure_player_hours='100', rate_per_1000_player_hours='0')
        self.assertEqual(numerical_route(r),'count_and_exposure')

    def test_fractional_reverse_count_is_not_count_likelihood(self):
        r=self.base();r.update(injury_count='20.83704',exposure_player_hours='99224')
        self.assertTrue(numerical_route(r).startswith('descriptive'))

    def test_sd_not_substituted_for_interval(self):
        r=self.base(rate_sd='0.5')
        self.assertTrue(numerical_route(r).startswith('descriptive'))

    def test_interval_outside_rate_not_usable(self):
        r=self.base();r.update(ci95_lower='3',ci95_upper='4')
        self.assertTrue(numerical_route(r).startswith('descriptive'))

    def test_burden_days_do_not_become_injury_counts(self):
        r=self.base(days_lost='20');r.update(metric='burden',exposure_player_hours='100')
        self.assertEqual(numerical_route(r),'days_and_exposure')


class DecisionCoverageTests(unittest.TestCase):
    def test_duplicate_decisions_are_rejected(self):
        import tempfile
        from pathlib import Path
        from build_selected_inputs import indexed
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'decisions.csv'
            p.write_text('observation_id,selection\na,select\na,hold\n')
            with self.assertRaises(ValueError):
                indexed(p, {'a'})

    def test_missing_decisions_are_rejected(self):
        import tempfile
        from pathlib import Path
        from build_selected_inputs import indexed
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'decisions.csv'
            p.write_text('observation_id,selection\na,select\n')
            with self.assertRaises(ValueError):
                indexed(p, {'a', 'b'})
